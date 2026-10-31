import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { AuthConfigurationError } from '../auth/env';

type Journal = { entries: unknown[] };

const committedMigrations = (): number => {
  try {
    const raw = readFileSync(
      join(process.cwd(), 'drizzle', 'meta', '_journal.json'),
      'utf8'
    );
    const journal: Journal = JSON.parse(raw);

    return journal.entries.length;
  } catch (error) {
    throw new AuthConfigurationError(
      `The committed Drizzle journal could not be read: ${String(error)}`,
      { cause: error }
    );
  }
};

/**
 * Refuses to let the server serve traffic on a schema it has not migrated. The
 * check runs at boot, before Next reports itself ready, and names the command
 * that fixes it.
 */
export const assertMigrationsApplied = async (
  databaseUrl: string
): Promise<void> => {
  const expected = committedMigrations();
  const client = postgres(databaseUrl, { max: 1 });

  try {
    const [row] = await client<{ count: number }[]>`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `;
    const applied = row?.count ?? 0;

    if (applied < expected) {
      throw new AuthConfigurationError(
        `The database has ${applied} of ${expected} migrations applied. Run "bun run db:migrate" before serving.`
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
    await client.end();
  }
};
