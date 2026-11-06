import type { BoardPage } from '@kiyora/sync';

const BOARDS = '/api/boards';

/**
 * The signed-in account's remote copies. With a page, the query asks for that
 * bounded slice; without one, the route answers its own default page.
 */
export const boardsUrl = (page?: BoardPage): string =>
  page === undefined
    ? BOARDS
    : `${BOARDS}?limit=${page.limit}&offset=${page.offset}`;

/** One remote copy's address, used to read or delete it. */
export const boardUrl = (id: string): string =>
  `${BOARDS}/${encodeURIComponent(id)}`;

/** The address one write is offered to, with its revision check. */
export const boardSyncUrl = (id: string): string => `${boardUrl(id)}/sync`;

/** The address a board's share token is created, read and revoked at. */
export const boardShareUrl = (id: string): string => `${boardUrl(id)}/share`;

/** The unlisted page a share token opens for a visitor. */
export const sharePageUrl = (token: string): string =>
  `/s/${encodeURIComponent(token)}`;
