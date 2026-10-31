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

/** One board's bytes offered to the server. */
export type UploadRequest = {
  id: string;
  /** The revision the local copy was built on, or null when linking. */
  baseRevision: number | null;
  payload: Board;
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
 * The wire the reconciler speaks. A transport maps these operations onto one
 * server's routes; the reconciler never sees a status code or a URL, so a fake
 * can stand in for the network in a unit test.
 */
export type SyncTransport = {
  upload: (request: UploadRequest) => Promise<UploadResult>;
  list: () => Promise<RemoteBoardSummary[]>;
  download: (id: string) => Promise<Board | null>;
};
