import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema';

type Connection = {
  client: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;
  databaseUrl: string;
};

const production = process.env.NODE_ENV === 'production';

let local: Connection | null = null;

/** Raised when one process asks for two different database URLs. */
class DatabaseConfigurationError extends Error {
  constructor() {
    super(
      'The database connection was already opened for a different URL; call closeDatabase() before switching.'
    );
    this.name = 'DatabaseConfigurationError';
  }
}

const holder = globalThis as typeof globalThis & {
  __kiyoraDatabase?: Connection;
};

/** Reads the process-wide connection, from `globalThis` only outside production. */
const cached = (): Connection | null =>
  production ? local : (holder.__kiyoraDatabase ?? null);

const remember = (connection: Connection | null): void => {
  if (production) {
    local = connection;
  } else {
    holder.__kiyoraDatabase = connection ?? undefined;
  }
};

/**
 * Opens the process-wide Postgres connection for the account tables. Outside
 * production the client is kept on `globalThis` so a development hot reload
 * reuses it instead of leaking a pool per edit; production keeps a module-local
 * handle and never publishes it to the global object.
 *
 * `max: 1` is deliberate: this deployment gets one client per process, which
 * serialises every query and forbids a nested query outside the transaction
 * that holds the connection. A transaction must do all its work through `tx`.
 */
export const getDatabase = (databaseUrl: string): Connection => {
  const existing = cached();

  if (existing) {
    if (existing.databaseUrl !== databaseUrl) {
      throw new DatabaseConfigurationError();
    }

    return existing;
  }

  const client = postgres(databaseUrl, { max: 1 });
  const connection = {
    client,
    databaseUrl,
    db: drizzle(client, { schema }),
  };

  remember(connection);

  return connection;
};

/**
 * Closes the process-wide client and forgets it, so a later `getDatabase` opens
 * a fresh connection. The handle is reset even when the close itself rejects.
 */
export const closeDatabase = async (): Promise<void> => {
  const existing = cached();

  if (existing === null) {
    return;
  }

  try {
    await existing.client.end();
  } finally {
    remember(null);
  }
};
