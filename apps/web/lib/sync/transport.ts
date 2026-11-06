import {
  type BoardPage,
  type DownloadedBoard,
  type RemoteBoardList,
  type RemoteBoardSummary,
  type RemoveResult,
  readSyncPayload,
  type SyncTransport,
  type UploadRequest,
  type UploadResult,
} from '@kiyora/sync';
import { boardSyncUrl, boardsUrl, boardUrl } from '../endpoints';

/** Why a remote exchange failed, in the vocabulary a surface can name. */
export type SyncExchangeReason = 'network' | 'server' | 'unauthorized';

/**
 * A failed remote exchange: the server answered nothing this client can use.
 * Absence is never a failure — `download` resolves `null` for that — so callers
 * can tell "the board is gone" from "the answer could not be read".
 */
export class SyncExchangeFailure extends Error {
  readonly reason: SyncExchangeReason;

  constructor(reason: SyncExchangeReason, options?: { cause?: unknown }) {
    super(`the sync exchange failed: ${reason}`, options);
    this.name = 'SyncExchangeFailure';
    this.reason = reason;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const jsonOf = async (
  response: Response
): Promise<Record<string, unknown> | null> => {
  try {
    const body: unknown = await response.json();
    return isObject(body) ? body : null;
  } catch {
    return null;
  }
};

const isSummary = (value: unknown): value is RemoteBoardSummary => {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.revision === 'number' &&
    typeof value.updatedAt === 'string' &&
    typeof value.bytes === 'number' &&
    (value.preview === null || typeof value.preview === 'string')
  );
};

/** One fetch that never rejects: a network failure is a `null` answer. */
const send = async (
  url: string,
  init?: RequestInit
): Promise<Response | null> => {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
};

const upload = async ({
  id,
  baseRevision,
  payload,
  preview,
}: UploadRequest): Promise<UploadResult> => {
  const response = await send(boardSyncUrl(id), {
    body: JSON.stringify({ baseRevision, payload, preview }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  if (response === null) {
    return { kind: 'network' };
  }

  if (response.status === 200) {
    const body = await jsonOf(response);
    return body !== null && typeof body.revision === 'number'
      ? { kind: 'accepted', revision: body.revision }
      : { kind: 'server' };
  }

  if (response.status === 401) {
    return { kind: 'unauthorized' };
  }

  if (response.status === 409) {
    const body = await jsonOf(response);

    if (body === null || typeof body.revision !== 'number') {
      return { kind: 'server' };
    }

    if (body.payload === null || body.payload === undefined) {
      return { kind: 'conflict', payload: null, revision: body.revision };
    }

    const read = readSyncPayload(body.payload);

    return read.ok
      ? { kind: 'conflict', payload: read.board, revision: body.revision }
      : { kind: 'server' };
  }

  if (response.status === 413) {
    const body = await jsonOf(response);
    return body !== null &&
      typeof body.bytes === 'number' &&
      typeof body.limit === 'number'
      ? { bytes: body.bytes, kind: 'too-large', limit: body.limit }
      : { kind: 'server' };
  }

  return response.status === 400 || response.status === 403
    ? { kind: 'invalid' }
    : { kind: 'server' };
};

const list = async (page: BoardPage): Promise<RemoteBoardList> => {
  const response = await send(boardsUrl(page));

  if (response === null) {
    return { status: 'network' };
  }
  if (response.status === 401) {
    return { status: 'unauthorized' };
  }
  if (response.status !== 200) {
    return { status: 'server' };
  }

  const body = await jsonOf(response);

  if (body === null) {
    return { status: 'server' };
  }

  const { boards: listed, total } = body;

  if (!Array.isArray(listed)) {
    return { status: 'server' };
  }

  if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
    return { status: 'server' };
  }

  const boards: RemoteBoardSummary[] = [];

  for (const row of listed) {
    if (!isSummary(row)) {
      return { status: 'server' };
    }
    boards.push(row);
  }

  return { boards, status: 'ok', total };
};

const download = async (id: string): Promise<DownloadedBoard | null> => {
  const response = await send(boardUrl(id));

  if (response === null) {
    throw new SyncExchangeFailure('network');
  }
  if (response.status === 404) {
    return null;
  }
  if (response.status === 401) {
    throw new SyncExchangeFailure('unauthorized');
  }
  if (response.status !== 200) {
    throw new SyncExchangeFailure('server');
  }

  const body = await jsonOf(response);

  if (body === null || typeof body.revision !== 'number') {
    throw new SyncExchangeFailure('server');
  }

  const read = readSyncPayload(body.payload);

  if (!read.ok) {
    throw new SyncExchangeFailure('server');
  }

  return { payload: read.board, revision: body.revision };
};

const remove = async (id: string): Promise<RemoveResult> => {
  const response = await send(boardUrl(id), { method: 'DELETE' });

  if (response === null) {
    return { kind: 'failed' };
  }
  if (response.status === 204) {
    return { kind: 'removed' };
  }
  if (response.status === 404) {
    return { kind: 'absent' };
  }

  return { kind: 'failed' };
};

/** The browser's transport: the sync route, the remote listing, a download and a delete. */
export const httpSyncTransport: SyncTransport = {
  download,
  list,
  remove,
  upload,
};
