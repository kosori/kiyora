import { currentAccount } from '~/lib/auth/session';

/**
 * The account behind the current session. A signed-out request is refused with
 * `401`, so the endpoint is a real authenticated boundary and not a hint.
 */
export const GET = async (): Promise<Response> => {
  const account = await currentAccount();

  if (account === null) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  return Response.json({ account });
};
