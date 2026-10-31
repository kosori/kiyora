import { createHash } from 'node:crypto';
import type { Board } from '@kiyora/model';
import { decideSync, type RemoteBoardSummary } from '@kiyora/sync';
import { and, desc, eq } from 'drizzle-orm';
import { readAuthEnv } from '../auth/env';
import { getDatabase } from './index';
import { board } from './schema';

/** The most preview this server stores; a larger one is refused, never cut. */
export const PREVIEW_LIMIT_BYTES = 32 * 1024;

/** One write offered to the server, after the route has read who is asking. */
export type BoardWrite = {
  id: string;
  ownerId: string;
  baseRevision: number | null;
  payload: unknown;
  /** The picture the client saved, already validated by the route. */
  preview: string | null;
};

/** What the store decided and, on a conflict, the copy that refused the write. */
export type BoardWriteResult =
  | { status: 'written'; revision: number }
  | { status: 'conflict'; revision: number; payload: Board | null }
  | { status: 'too-large'; bytes: number; limit: number }
  | { status: 'invalid'; reason: 'schema' | 'version' }
  | { status: 'forbidden' };

const hashOf = (bytes: string): string =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * The preview a write may store, or null when it is not one this server will
 * keep. The server has no measurer, so it never paints a board itself: it only
 * checks the shape the client saved and the cap, and a preview that fails
 * either is dropped rather than failing the write.
 */
export const readPreview = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  if (!(value.startsWith('<svg') && value.endsWith('</svg>'))) {
    return null;
  }

  return Buffer.byteLength(value, 'utf8') > PREVIEW_LIMIT_BYTES ? null : value;
};

/** One board's remote copy as a download carries it. */
export type BoardDownload = {
  payload: Board;
  revision: number;
};

const database = () => {
  const config = readAuthEnv();

  if (config === null) {
    throw new Error('Board sync needs the account configuration to be set.');
  }

  return getDatabase(config.databaseUrl).db;
};

/**
 * Every remote copy this owner holds, newest change first. Only the columns the
 * library lists are selected, so listing never reads or parses a payload.
 */
export const listBoards = async (
  ownerId: string
): Promise<RemoteBoardSummary[]> => {
  const rows = await database()
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
    .orderBy(desc(board.updatedAt));

  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  }));
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
 */
export const writeBoard = ({
  id,
  ownerId,
  baseRevision,
  payload,
  preview,
}: BoardWrite): Promise<BoardWriteResult> => {
  const config = readAuthEnv();

  if (config === null) {
    throw new Error('Board sync needs the account configuration to be set.');
  }

  const serialized = JSON.stringify(payload);
  const bytes = Buffer.byteLength(serialized, 'utf8');
  const payloadHash = hashOf(serialized);
  const { db } = getDatabase(config.databaseUrl);

  return db.transaction(async (tx) => {
    const [stored] = await tx
      .select()
      .from(board)
      .where(eq(board.id, id))
      .for('update');

    if (stored !== undefined && stored.ownerId !== ownerId) {
      return { status: 'forbidden' };
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
      await tx.insert(board).values({ id, ownerId, ...columns });
    } else {
      await tx.update(board).set(columns).where(eq(board.id, id));
    }

    return { revision: decision.revision, status: 'written' };
  });
};
