import { createHash } from 'node:crypto';
import { type Board, projectBoard } from '@kiyora/model';
import { decideSync } from '@kiyora/sync';
import { eq } from 'drizzle-orm';
import { readAuthEnv } from '../auth/env';
import { getDatabase } from './index';
import { board } from './schema';

/** The most preview a row keeps; a larger one is omitted rather than cut. */
export const PREVIEW_LIMIT_BYTES = 32 * 1024;

/** One write offered to the server, after the route has read who is asking. */
export type BoardWrite = {
  id: string;
  ownerId: string;
  baseRevision: number | null;
  payload: unknown;
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

/** The preview a row caches, derived from the payload the server just validated. */
const previewOf = (payload: Board): string | null => {
  const svg = projectBoard(payload, { theme: payload.settings.theme });

  return Buffer.byteLength(svg, 'utf8') > PREVIEW_LIMIT_BYTES ? null : svg;
};

/**
 * Writes one board's remote copy under a revision check. The row is locked
 * before it is read, so two writes that name the same revision cannot both be
 * accepted. The title, byte size, preview and hash all come from the payload
 * this call validated, never from the client's claims about them.
 */
export const writeBoard = ({
  id,
  ownerId,
  baseRevision,
  payload,
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
      previewSvg: previewOf(decision.board),
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
