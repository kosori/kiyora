import { createHash } from 'node:crypto';
import { type Board, PREVIEW_LIMIT_BYTES, unsafeSvg } from '@kiyora/model';
import {
  type BoardPage,
  decideSync,
  type RemoteBoardSummary,
} from '@kiyora/sync';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { readAuthEnv } from '../auth/env';
import { getDatabase } from './index';
import { board } from './schema';

/** One write offered to the server, after the route has read who is asking. */
export type BoardWrite = {
  id: string;
  ownerId: string;
  baseRevision: number | null;
  payload: unknown;
  /** The picture the client saved, already vetted by `readPreview`. */
  preview: string | null;
};

/** What the store decided and, on a conflict, the copy that refused the write. */
export type BoardWriteResult =
  | { status: 'written'; revision: number }
  | { status: 'conflict'; revision: number; payload: Board | null }
  | { status: 'too-large'; bytes: number; limit: number }
  | { status: 'invalid'; reason: 'schema' | 'version' };

/** A write the database could not complete; the route reports it as a server fault. */
export class BoardWriteFailure extends Error {
  constructor(cause: unknown) {
    super('the board write could not be completed', { cause });
    this.name = 'BoardWriteFailure';
  }
}

/** What the store decided about one delete. */
export type BoardDeleteResult = { status: 'deleted' } | { status: 'absent' };

/** One page of an owner's remote copies and the account's whole count. */
export type BoardList = {
  boards: RemoteBoardSummary[];
  total: number;
};

const hashOf = (bytes: string): string =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * The preview a write may store, or null when it is not one this server will
 * keep. The server has no measurer, so it never paints a board itself: it only
 * checks that the client saved a bounded SVG this browser can safely render,
 * and a preview that fails either check is dropped rather than failing the
 * write. The client's projection ends with a newline, so surrounding whitespace
 * is allowed and the bytes are kept as sent.
 */
export const readPreview = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (
    !(trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')) ||
    unsafeSvg(trimmed) !== null
  ) {
    return null;
  }

  return Buffer.byteLength(value, 'utf8') > PREVIEW_LIMIT_BYTES ? null : value;
};

/** One board's remote copy as a download carries it. */
export type BoardDownload = {
  payload: Board;
  revision: number;
};

/** The one connection every store function reads and writes through. */
const database = () => {
  const config = readAuthEnv();

  if (config === null) {
    throw new Error('Board sync needs the account configuration to be set.');
  }

  return getDatabase(config.databaseUrl).db;
};

/**
 * One bounded page of this owner's remote copies, newest change first, with
 * ties broken by id so a page boundary is stable. Only the columns the library
 * lists are selected, so listing never reads or parses a payload. `total` is the
 * account's whole count, so a short page is never mistaken for the account.
 */
export const listBoards = async (
  ownerId: string,
  page: BoardPage
): Promise<BoardList> => {
  const db = database();
  const [rows, counted] = await Promise.all([
    db
      .select({
        bytes: board.bytes,
        id: board.id,
        preview: board.previewSvg,
        revision: board.revision,
        title: board.title,
        updatedAt: board.updatedAt,
      })
      .from(board)
      .where(eq(board.ownerId, ownerId))
      .orderBy(desc(board.updatedAt), asc(board.id))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ total: count() }).from(board).where(eq(board.ownerId, ownerId)),
  ]);

  return {
    boards: rows.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    })),
    total: Number(counted[0]?.total ?? 0),
  };
};

/**
 * One remote copy's payload and revision for its owner, or `null` when this
 * account owns no board at that id. A board another account owns is reported
 * as absent rather than as forbidden, so a download cannot confirm its id.
 */
export const readBoard = async ({
  id,
  ownerId,
}: {
  id: string;
  ownerId: string;
}): Promise<BoardDownload | null> => {
  const [row] = await database()
    .select({ payload: board.payload, revision: board.revision })
    .from(board)
    .where(and(eq(board.id, id), eq(board.ownerId, ownerId)));

  return row ?? null;
};

/**
 * Writes one board's remote copy under a revision check. The row is locked
 * before it is read, so two writes that name the same revision cannot both be
 * accepted. The title, byte size and hash come from the payload this call
 * validated; the preview is the picture the client saved, because the server
 * has no measurer to paint one. Nothing is trusted from the client's claims
 * about a payload's columns.
 *
 * A first write inserts with `onConflictDoNothing`, because a lock cannot hold a
 * row that does not exist yet: a lost race re-reads the real row and decides
 * again, twice at most, then answers the stored revision as a conflict. A board
 * another account owns is the same conflict answer, so the endpoint never
 * confirms an id it will not write.
 *
 * @throws {BoardWriteFailure} when the database could not complete the write.
 */
export const writeBoard = async ({
  id,
  ownerId,
  baseRevision,
  payload,
  preview,
}: BoardWrite): Promise<BoardWriteResult> => {
  let serialized: string;

  try {
    serialized = JSON.stringify(payload);
  } catch {
    return { reason: 'schema', status: 'invalid' };
  }

  const bytes = Buffer.byteLength(serialized, 'utf8');
  const payloadHash = hashOf(serialized);

  try {
    const db = database();

    return await db.transaction(async (tx) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: a lost insert race must re-read the real row before deciding again.
        const [stored] = await tx
          .select()
          .from(board)
          .where(eq(board.id, id))
          .for('update');

        if (stored !== undefined && stored.ownerId !== ownerId) {
          return { payload: null, revision: 0, status: 'conflict' };
        }

        const decision = decideSync(
          stored === undefined
            ? null
            : { payloadHash: stored.payloadHash, revision: stored.revision },
          { baseRevision, bytes, payload, payloadHash }
        );

        if (decision.kind === 'too-large') {
          return {
            bytes: decision.bytes,
            limit: decision.limit,
            status: 'too-large',
          };
        }

        if (decision.kind === 'invalid') {
          return { reason: decision.reason, status: 'invalid' };
        }

        if (decision.kind === 'conflict') {
          return {
            payload: stored?.payload ?? null,
            revision: decision.revision,
            status: 'conflict',
          };
        }

        if (decision.kind === 'idempotent') {
          return { revision: decision.revision, status: 'written' };
        }

        const columns = {
          bytes,
          payload: decision.board,
          payloadHash,
          previewSvg: preview,
          revision: decision.revision,
          title: decision.board.title,
          updatedAt: new Date(),
        };

        if (decision.kind === 'create') {
          const [created] = await tx
            .insert(board)
            .values({ id, ownerId, ...columns })
            .onConflictDoNothing({ target: board.id })
            .returning({ id: board.id });

          if (created !== undefined) {
            return { revision: decision.revision, status: 'written' };
          }

          continue;
        }

        await tx.update(board).set(columns).where(eq(board.id, id));

        return { revision: decision.revision, status: 'written' };
      }

      const [stored] = await tx
        .select()
        .from(board)
        .where(eq(board.id, id))
        .for('update');

      return {
        payload: stored?.payload ?? null,
        revision: stored?.revision ?? 0,
        status: 'conflict',
      };
    });
  } catch (error) {
    // biome-ignore lint/style/useErrorCause: the cause is handed to `Error.cause` by BoardWriteFailure's constructor.
    throw new BoardWriteFailure(error);
  }
};

/**
 * Deletes one board's remote copy when it belongs to `ownerId`. A board that is
 * absent and a board owned by someone else are both `absent`, so the route
 * cannot be used to learn which ids another account holds.
 */
export const deleteBoard = async ({
  id,
  ownerId,
}: {
  id: string;
  ownerId: string;
}): Promise<BoardDeleteResult> => {
  const removed = await database()
    .delete(board)
    .where(and(eq(board.id, id), eq(board.ownerId, ownerId)))
    .returning({ id: board.id });

  return removed.length === 0 ? { status: 'absent' } : { status: 'deleted' };
};
