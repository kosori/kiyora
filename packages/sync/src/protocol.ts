import { type Board, boardSchema, SCHEMA_VERSION } from '@kiyora/model';

/**
 * The largest board that may be synced: one serialized document, below the
 * function body cap both Vercel directions share (ADR-0012). A board above it
 * stays local and says so; nothing is truncated.
 */
export const SYNC_LIMIT_BYTES = 4 * 1024 * 1024;

/** The part of the remote copy the revision check needs. */
export type StoredRemote = {
  revision: number;
  payloadHash: string;
};

/** One write as the client offers it and the server considers it. */
export type SyncWrite = {
  /** The revision the local copy was built on, or null when linking. */
  baseRevision: number | null;
  payload: unknown;
  /** The hash of the serialized payload the client sent. */
  payloadHash: string;
  /** The UTF-8 size of that serialized payload. */
  bytes: number;
};

/** Why a payload cannot be accepted, whether or not a revision is free. */
export type PayloadProblem = 'schema' | 'version';

/**
 * What the server does with one write. `create`, `accept` and `idempotent`
 * carry the validated board, so the caller extracts its columns without parsing
 * the payload a second time.
 */
export type SyncDecision =
  | { kind: 'create'; revision: number; board: Board }
  | { kind: 'accept'; revision: number; board: Board }
  | { kind: 'idempotent'; revision: number; board: Board }
  | { kind: 'conflict'; revision: number }
  | { kind: 'too-large'; bytes: number; limit: number }
  | { kind: 'invalid'; reason: PayloadProblem };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads one payload as a board of the running schema. An older or newer
 * `schemaVersion` is refused rather than migrated: migration is the client's
 * job, and a server that lifted payloads would be a second source of truth.
 */
export const readSyncPayload = (
  payload: unknown
): { ok: true; board: Board } | { ok: false; reason: PayloadProblem } => {
  if (!isObject(payload)) {
    return { ok: false, reason: 'schema' };
  }
  if (payload.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, reason: 'version' };
  }

  const parsed = boardSchema.safeParse(payload);

  return parsed.success
    ? { board: parsed.data, ok: true }
    : { ok: false, reason: 'schema' };
};

/**
 * The decision both copies share. Size and validity are settled before the
 * revision, so an oversized or invalid write never reads as a conflict. A
 * payload whose hash already equals the stored one is the retry of a write that
 * committed, so it answers with the current revision instead of bumping it.
 */
export const decideSync = (
  stored: StoredRemote | null,
  write: SyncWrite
): SyncDecision => {
  if (write.bytes > SYNC_LIMIT_BYTES) {
    return {
      bytes: write.bytes,
      kind: 'too-large',
      limit: SYNC_LIMIT_BYTES,
    };
  }

  const read = readSyncPayload(write.payload);

  if (!read.ok) {
    return { kind: 'invalid', reason: read.reason };
  }

  if (stored === null) {
    return write.baseRevision === null
      ? { board: read.board, kind: 'create', revision: 1 }
      : { kind: 'conflict', revision: 0 };
  }

  if (stored.payloadHash === write.payloadHash) {
    return { board: read.board, kind: 'idempotent', revision: stored.revision };
  }

  return write.baseRevision === stored.revision
    ? { board: read.board, kind: 'accept', revision: stored.revision + 1 }
    : { kind: 'conflict', revision: stored.revision };
};
