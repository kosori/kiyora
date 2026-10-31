import { headers } from 'next/headers';
import type { AccountSummary } from './account';
import { readAuthEnv } from './env';
import { getAuth } from './server';

/**
 * The account behind the current request, or null when no one is signed in or
 * accounts are not configured. Read on the server so a signed-out page makes no
 * call to its own API.
 */
export const currentAccount = async (): Promise<AccountSummary | null> => {
  if (readAuthEnv() === null) {
    return null;
  }

  const session = await getAuth().api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  return { email: session.user.email, name: session.user.name };
};
