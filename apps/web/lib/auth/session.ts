import { headers } from 'next/headers';
import type { AccountSummary } from './account';
import { readAuthEnv } from './env';
import { getAuth } from './server';

const readSession = async () => {
  if (readAuthEnv() === null) {
    return null;
  }

  return getAuth().api.getSession({ headers: await headers() });
};

/**
 * The account behind the current request, or null when no one is signed in or
 * accounts are not configured. Read on the server so a signed-out page makes no
 * call to its own API.
 */
export const currentAccount = async (): Promise<AccountSummary | null> => {
  const session = await readSession();

  if (!session) {
    return null;
  }

  return { email: session.user.email, name: session.user.name };
};

/**
 * The signed-in account's id, or null when the request carries no session. The
 * server reads it before touching a board, first so a signed-out write is a
 * 401 rather than a missing row, and then so the owner check has something to
 * compare against.
 */
export const currentUserId = async (): Promise<string | null> => {
  const session = await readSession();

  return session?.user.id ?? null;
};
