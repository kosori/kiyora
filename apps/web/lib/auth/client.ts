import { createAuthClient } from 'better-auth/react';

type AuthClient = ReturnType<typeof createAuthClient>;

let client: AuthClient | null = null;

/**
 * The browser's client for the account endpoints, built on first use so merely
 * importing this module never touches `window` or a React hook. The same origin
 * the server trusts is passed through `NEXT_PUBLIC_APP_URL` when it is set, so a
 * reverse proxy or a non-default port cannot make the halves disagree.
 */
export const getAuthClient = (): AuthClient => {
  if (client !== null) {
    return client;
  }

  const baseURL = process.env.NEXT_PUBLIC_APP_URL;

  client = createAuthClient(
    baseURL === undefined || baseURL === '' ? undefined : { baseURL }
  );

  return client;
};
