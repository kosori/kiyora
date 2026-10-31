import postgres from 'postgres';
import { E2E_DATABASE_URL } from '../e2e-server';

/**
 * Empties the account tables so each server test starts signed out and the
 * project can run again without the previous run's users in the way.
 */
export const resetAccounts = async (): Promise<void> => {
  const client = postgres(E2E_DATABASE_URL, { max: 1 });

  try {
    await client`
      truncate table "session", "account", "verification", "user"
      restart identity cascade
    `;
  } finally {
    await client.end();
  }
};
