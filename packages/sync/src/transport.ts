import type { Board } from '@kiyora/model';

/** One remote copy as the library lists it, without its payload. */
export type RemoteBoardSummary = {
  id: string;
  title: string;
  revision: number;
  updatedAt: string;
  bytes: number;
  preview: string | null;
};

/** One board's bytes offered to the server, with the picture the client saved. */
export type UploadRequest = {
  id: string;
  /** The revision the local copy was built on, or null when linking. */
  baseRevision: number | null;
  payload: Board;
  /** The preview the last save stored, or null when there is none to send. */
  preview: string | null;
};

/** One remote copy as a download carries it: the bytes and the revision they are. */
export type DownloadedBoard = {
  payload: Board;
  revision: number;
};

/** What the server answered to one upload. */
export type UploadResult =
  | { kind: 'accepted'; revision: number }
  | { kind: 'conflict'; revision: number; payload: Board | null }
  | { kind: 'too-large'; bytes: number; limit: number }
  | { kind: 'unauthorized' }
  | { kind: 'invalid' }
  | { kind: 'network' };

/**
 * What the server answered to one delete. `absent` is a board the server does
 * not hold, which still lets the caller drop its local copy; `failed` is any
 * answer that leaves the remote copy possibly alive.
 */
export type RemoveResult =
  | { kind: 'removed' }
  | { kind: 'absent' }
  | { kind: 'failed' };

/**
 * The wire the reconciler speaks. A transport maps these operations onto one
 * server's routes; the reconciler never sees a status code or a URL, so a fake
 * can stand in for the network in a unit test.
 */
export type SyncTransport = {
  upload: (request: UploadRequest) => Promise<UploadResult>;
  list: () => Promise<RemoteBoardSummary[]>;
  download: (id: string) => Promise<DownloadedBoard | null>;
  remove: (id: string) => Promise<RemoveResult>;
};
