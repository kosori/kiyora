import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { AuthConfigurationError } from '../auth/env';

type Journal = { entries: { when: number }[] };

type Committed = { count: number; latest: number | null };

const JOURNAL_PATH = fileURLToPath(
  new URL('../../drizzle/meta/_journal.json', import.meta.url)
);

const isJournal = (value: unknown): value is Journal => {
  if (typeof value !== 'object' || value === null || !('entries' in value)) {
    return false;
  }

  const { entries } = value;

  if (!Array.isArray(entries)) {
    return false;
  }

  return entries.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'when' in entry &&
      typeof entry.when === 'number'
  );
};

const readJournal = (): unknown => {
  try {
    return JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
  } catch (error) {
    throw new AuthConfigurationError(
      `The committed Drizzle journal could not be read at ${JOURNAL_PATH}: ${String(error)}`,
      { cause: error }
    );
  }
};

/** The committed journal's identity: how many migrations, and its newest. */
const committedMigrations = (): Committed => {
  const journal = readJournal();

  if (!isJournal(journal)) {
    throw new AuthConfigurationError(
      'The committed Drizzle journal is malformed: its "entries" array is missing or an entry has no numeric "when".'
    );
  }

  return {
    count: journal.entries.length,
    latest: journal.entries.at(-1)?.when ?? null,
  };
};

/**
 * Refuses to let the server serve traffic on a schema it has not migrated. The
 * check runs at boot, before Next reports itself ready, and names the command
 * that fixes it. A database ahead of the journal, or holding a different set of
 * migrations, fails the same way as one that is behind.
 */
export const assertMigrationsApplied = async (
  databaseUrl: string
): Promise<void> => {
  const expected = committedMigrations();
  let client: ReturnType<typeof postgres> | undefined;

  try {
    client = postgres(databaseUrl, { max: 1 });

    const [row] = await client<{ count: number; latest: string | null }[]>`
      select count(*)::int as count, max(created_at)::text as latest
      from drizzle.__drizzle_migrations
    `;
    const applied = row?.count ?? 0;
    const latest =
      row?.latest === null || row?.latest === undefined
        ? null
        : Number(row.latest);

    if (applied !== expected.count || latest !== expected.latest) {
      throw new AuthConfigurationError(
        applied === expected.count
          ? `The database's newest migration (${latest ?? 'none'}) does not match the committed journal (${expected.latest ?? 'none'}). Run "bun run db:migrate" before serving.`
          : `The database has ${applied} of ${expected.count} committed migrations applied. Run "bun run db:migrate" before serving.`
      );
    }
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      throw error;
    }

    throw new AuthConfigurationError(
      `The database schema could not be read. Run "bun run db:migrate" before serving. ${String(error)}`,
      { cause: error }
    );
  } finally {
    if (client !== undefined) {
      try {
        await client.end();
      } catch {
        // Closing the boot-time probe must never mask the real boot failure.
      }
    }
  }
};
