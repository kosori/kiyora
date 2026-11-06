import { boardShareUrl, sharePageUrl } from './endpoints';

/**
 * What a share call learned. `ok` carries the live token, or `null` when the
 * board has no address yet; `unauthorized` means nobody is signed in, so the
 * answer is a sign-in rather than a failure; `unavailable` means the exchange or
 * the server's answer could not be used.
 */
export type ShareResult =
  | { status: 'ok'; token: string | null }
  | { status: 'unauthorized' }
  | { status: 'unavailable' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The token in a share answer, or `unavailable` when the shape is not the contract's. */
const resultOf = (body: unknown): ShareResult => {
  if (!(isRecord(body) && 'token' in body)) {
    return { status: 'unavailable' };
  }

  const { token } = body;

  if (token === null) {
    return { status: 'ok', token: null };
  }

  return typeof token === 'string'
    ? { status: 'ok', token }
    : { status: 'unavailable' };
};

const request = async (
  boardId: string,
  method: 'GET' | 'POST' | 'DELETE'
): Promise<ShareResult> => {
  let response: Response;
  try {
    response = await fetch(boardShareUrl(boardId), { method });
  } catch {
    return { status: 'unavailable' };
  }

  if (response.status === 401) {
    return { status: 'unauthorized' };
  }

  if (!response.ok) {
    return { status: 'unavailable' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: 'unavailable' };
  }

  return resultOf(body);
};

/** The board's live share token, or `null` when it has no address yet. */
export const readShare = (boardId: string): Promise<ShareResult> =>
  request(boardId, 'GET');

/** Creates a share token, revoking the board's previous live address. */
export const createShare = (boardId: string): Promise<ShareResult> =>
  request(boardId, 'POST');

/** Revokes the board's live share token. */
export const revokeShare = (boardId: string): Promise<ShareResult> =>
  request(boardId, 'DELETE');

/**
 * The address a visitor opens, made absolute against `origin` when one is
 * given, else this browser's origin. Without a window — a server component or a
 * test — it returns the relative address instead of throwing, so the module is
 * safe to import anywhere.
 */
export const absoluteShareUrl = (token: string, origin?: string): string => {
  const base =
    origin ?? (typeof window === 'undefined' ? null : window.location.origin);

  return base === null
    ? sharePageUrl(token)
    : new URL(sharePageUrl(token), base).href;
};
