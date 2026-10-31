import type { Board } from '@kiyora/model';
import type {
  DownloadedBoard,
  RemoteBoardSummary,
  SyncTransport,
  UploadRequest,
  UploadResult,
} from '@kiyora/sync';

const jsonOf = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const upload = async ({
  id,
  baseRevision,
  payload,
  preview,
}: UploadRequest): Promise<UploadResult> => {
  let response: Response;
  try {
    response = await fetch(`/api/boards/${encodeURIComponent(id)}/sync`, {
      body: JSON.stringify({ baseRevision, payload, preview }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  } catch {
    return { kind: 'network' };
  }

  if (response.status === 200) {
    const body = await jsonOf(response);
    return {
      kind: 'accepted',
      revision: typeof body.revision === 'number' ? body.revision : 1,
    };
  }

  if (response.status === 401) {
    return { kind: 'unauthorized' };
  }

  if (response.status === 409) {
    const body = await jsonOf(response);
    return {
      kind: 'conflict',
      payload: (body.payload as Board | null) ?? null,
      revision: typeof body.revision === 'number' ? body.revision : 0,
    };
  }

  if (response.status === 413) {
    const body = await jsonOf(response);
    return {
      bytes: typeof body.bytes === 'number' ? body.bytes : 0,
      kind: 'too-large',
      limit: typeof body.limit === 'number' ? body.limit : 0,
    };
  }

  if (response.status === 400 || response.status === 403) {
    return { kind: 'invalid' };
  }

  return { kind: 'network' };
};

const list = async (): Promise<RemoteBoardSummary[]> => {
  const response = await fetch('/api/boards');

  if (!response.ok) {
    throw new Error(`listing boards failed with ${response.status}`);
  }

  const body = (await response.json()) as { boards?: RemoteBoardSummary[] };

  return body.boards ?? [];
};

const download = async (id: string): Promise<DownloadedBoard | null> => {
  const response = await fetch(`/api/boards/${encodeURIComponent(id)}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`downloading a board failed with ${response.status}`);
  }

  const body = (await response.json()) as {
    payload?: Board;
    revision?: number;
  };

  if (body.payload === undefined) {
    return null;
  }

  return {
    payload: body.payload,
    revision: typeof body.revision === 'number' ? body.revision : 0,
  };
};

/** The browser's transport: the sync route, and the two reads #75 will use. */
export const httpSyncTransport: SyncTransport = { download, list, upload };
