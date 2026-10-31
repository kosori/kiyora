import { randomBytes } from 'node:crypto';
import type { Board } from '@kiyora/model';
import { and, eq, isNull } from 'drizzle-orm';
import { readAuthEnv } from '../auth/env';
import { getDatabase } from './index';
import { board, shareLink } from './schema';

/** What a share lookup found for one board and one owner. */
export type ShareLinkLookup =
  | { status: 'live'; token: string }
  | { status: 'none' }
  | { status: 'not-linked' }
  | { status: 'forbidden' };

const tokenOf = (): string => randomBytes(16).toString('base64url');

const database = () => {
  const config = readAuthEnv();

  if (config === null) {
    throw new Error('Share links need the account configuration to be set.');
  }

  return getDatabase(config.databaseUrl).db;
};

/**
 * Reads the board's live share token for its owner. A board with no remote copy
 * has nothing to share, and a board owned by someone else is refused before a
 * token is looked up.
 */
export const readShareLink = async ({
  boardId,
  ownerId,
}: {
  boardId: string;
  ownerId: string;
}): Promise<ShareLinkLookup> => {
  const db = database();
  const [stored] = await db
    .select({ ownerId: board.ownerId })
    .from(board)
    .where(eq(board.id, boardId));

  if (stored === undefined) {
    return { status: 'not-linked' };
  }
  if (stored.ownerId !== ownerId) {
    return { status: 'forbidden' };
  }

  const [live] = await db
    .select({ token: shareLink.token })
    .from(shareLink)
    .where(and(eq(shareLink.boardId, boardId), isNull(shareLink.revokedAt)))
    .limit(1);

  return live === undefined
    ? { status: 'none' }
    : { status: 'live', token: live.token };
};

/**
 * Creates the board's one live share link. The board row is locked before any
 * token is written, and every live token for the board is revoked in the same
 * transaction, so regenerating revokes the previous address rather than adding
 * a second one.
 */
export const createShareLink = ({
  boardId,
  ownerId,
}: {
  boardId: string;
  ownerId: string;
}): Promise<ShareLinkLookup> => {
  const db = database();

  return db.transaction(async (tx) => {
    const [stored] = await tx
      .select({ ownerId: board.ownerId })
      .from(board)
      .where(eq(board.id, boardId))
      .for('update');

    if (stored === undefined) {
      return { status: 'not-linked' };
    }
    if (stored.ownerId !== ownerId) {
      return { status: 'forbidden' };
    }

    await tx
      .update(shareLink)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLink.boardId, boardId), isNull(shareLink.revokedAt)));

    const token = tokenOf();
    await tx.insert(shareLink).values({ boardId, token });

    return { status: 'live', token };
  });
};

/**
 * Revokes every live share link a board has. The board stays linked; only its
 * public address stops resolving.
 */
export const revokeShareLink = ({
  boardId,
  ownerId,
}: {
  boardId: string;
  ownerId: string;
}): Promise<ShareLinkLookup> => {
  const db = database();

  return db.transaction(async (tx) => {
    const [stored] = await tx
      .select({ ownerId: board.ownerId })
      .from(board)
      .where(eq(board.id, boardId))
      .for('update');

    if (stored === undefined) {
      return { status: 'not-linked' };
    }
    if (stored.ownerId !== ownerId) {
      return { status: 'forbidden' };
    }

    await tx
      .update(shareLink)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLink.boardId, boardId), isNull(shareLink.revokedAt)));

    return { status: 'none' };
  });
};

/**
 * The board a live token names, read without a session. A revoked or unknown
 * token resolves to null, so a visitor sees a readable page rather than a
 * crash; the payload is the latest committed revision, never a cached copy.
 */
export const resolveShareLink = async (
  token: string
): Promise<Board | null> => {
  if (token === '' || readAuthEnv() === null) {
    return null;
  }

  const db = database();
  const [row] = await db
    .select({ payload: board.payload })
    .from(shareLink)
    .innerJoin(board, eq(board.id, shareLink.boardId))
    .where(and(eq(shareLink.token, token), isNull(shareLink.revokedAt)))
    .limit(1);

  return row?.payload ?? null;
};
