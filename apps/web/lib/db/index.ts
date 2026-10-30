import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema';

type Connection = {
  client: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;
};

const holder = globalThis as typeof globalThis & {
  __kiyoraDatabase?: Connection;
};

/**
 * Opens the process-wide Postgres connection for the account tables. The client
 * is kept on `globalThis` so development hot reloads reuse it instead of
 * leaking a pool per edit.
 */
export const getDatabase = (databaseUrl: string): Connection => {
  const existing = holder.__kiyoraDatabase;

  if (existing) {
    return existing;
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });
  const connection = { client, db };

  holder.__kiyoraDatabase = connection;

  return connection;
};
