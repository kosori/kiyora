import { faultOf, type StorageFault } from '@kiyora/model';
import { headers } from 'next/headers';
import { cache } from 'react';
import type { AccountSummary } from './account';
import { readAuthEnv } from './env';
import { getAuth } from './server';

/**
 * What one request knows about its account. A failed lookup is a fault rather
 * than a thrown error, so a page can still render the library or the editor and
 * say that the account could not be checked.
 */
export type SessionSnapshot = {
  account: AccountSummary | null;
  userId: string | null;
  fault: StorageFault | null;
};

const SIGNED_OUT: SessionSnapshot = {
  account: null,
  fault: null,
  userId: null,
};

/**
 * Keeps the visible label readable when a provider supplies no display name or
 * no address: the email's local part stands in for the name, the name stands in
 * for the email, and neither is ever blank.
 */
const summaryOf = (user: { name: string; email: string }): AccountSummary => {
  const name = user.name.trim();
  const email = user.email.trim();

  if (name !== '') {
    return { email: email === '' ? name : email, name };
  }

  if (email !== '') {
    return { email, name: email.split('@')[0] ?? email };
  }

  return { email: '', name: 'Your account' };
};

/**
 * The session behind this request, read once. React's `cache` deduplicates the
 * database and cookie reads across every caller in one request, and a rejected
 * lookup becomes a surfaced fault instead of rejecting the whole render.
 */
const readSession = cache(async (): Promise<SessionSnapshot> => {
  if (readAuthEnv() === null) {
    return SIGNED_OUT;
  }

  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });

    if (session === null) {
      return SIGNED_OUT;
    }

    return {
      account: summaryOf(session.user),
      fault: null,
      userId: session.user.id,
    };
  } catch (error) {
    return { account: null, fault: faultOf(error), userId: null };
  }
});

/**
 * The account behind the current request, or null when no one is signed in,
 * accounts are not configured, or the lookup failed. Route handlers use this;
 * a page that wants to surface the failure uses `currentSession`.
 */
export const currentAccount = async (): Promise<AccountSummary | null> =>
  (await readSession()).account;

/**
 * The signed-in account's id, or null when the request carries no session. The
 * server reads it before touching a board, first so a signed-out write is a
 * 401 rather than a missing row, and then so the owner check has something to
 * compare against.
 */
export const currentUserId = async (): Promise<string | null> =>
  (await readSession()).userId;

/**
 * The whole identity state for one page render: the account, its id, and the
 * fault when the lookup failed. The library and editor stay usable either way.
 */
export const currentSession = (): Promise<SessionSnapshot> => readSession();
