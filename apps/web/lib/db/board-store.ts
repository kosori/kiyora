import { createHash } from 'node:crypto';
import type { Board } from '@kiyora/model';
import { decideSync } from '@kiyora/sync';
import { and, eq } from 'drizzle-orm';
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

/** What the store decided about one delete. */
export type BoardDeleteResult = { status: 'deleted' } | { status: 'absent' };

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
  const config = readAuthEnv();

  if (config === null) {
    throw new Error('Board sync needs the account configuration to be set.');
  }

  const { db } = getDatabase(config.databaseUrl);
  const removed = await db
    .delete(board)
    .where(and(eq(board.id, id), eq(board.ownerId, ownerId)))
    .returning({ id: board.id });

  return removed.length === 0 ? { status: 'absent' } : { status: 'deleted' };
};
