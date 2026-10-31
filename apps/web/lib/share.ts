const request = async (
  boardId: string,
  method: 'GET' | 'POST' | 'DELETE'
): Promise<string | null> => {
  const response = await fetch(
    `/api/boards/${encodeURIComponent(boardId)}/share`,
    { method }
  );

  if (!response.ok) {
    throw new Error(`share request failed with ${response.status}`);
  }

  const body = (await response.json()) as { token?: unknown };

  return typeof body.token === 'string' ? body.token : null;
};

/** The board's live share token, or null when it has no address yet. */
export const readShare = (boardId: string): Promise<string | null> =>
  request(boardId, 'GET');

/** Creates a share token, revoking the board's previous live address. */
export const createShare = (boardId: string): Promise<string | null> =>
  request(boardId, 'POST');

/** Revokes the board's live share token. */
export const revokeShare = (boardId: string): Promise<string | null> =>
  request(boardId, 'DELETE');

/** The address a visitor opens, made absolute against this app's origin. */
export const absoluteShareUrl = (token: string): string =>
  new URL(`/s/${encodeURIComponent(token)}`, window.location.origin).href;
