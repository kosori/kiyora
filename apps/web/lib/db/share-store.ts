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

/** Raised when a share link is asked for on a server with no account setup. */
export class ShareConfigurationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ShareConfigurationError';
  }
}

/** Raised when a fresh token collides on every bounded attempt. */
class ShareTokenError extends Error {
  constructor(options?: { cause?: unknown }) {
    super(
      'A fresh share token could not be minted after three attempts.',
      options
    );
    this.name = 'ShareTokenError';
  }
}

type Database = ReturnType<typeof getDatabase>['db'];

type BoardTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

type BoardLock =
  | { status: 'locked' }
  | { status: 'not-linked' }
  | { status: 'forbidden' };

const TOKEN_ATTEMPTS = 3;

const tokenOf = (): string => randomBytes(16).toString('base64url');

const database = (): Database => {
  const config = readAuthEnv();

  if (config === null) {
    throw new ShareConfigurationError(
      'Share links need the account configuration to be set.'
    );
  }

  return getDatabase(config.databaseUrl).db;
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === '23505';

/**
 * Locked reads one board and revokes its live token in the same transaction,
 * so authorization and revocation can never disagree. A missing row and a
 * foreign owner are distinct answers the caller maps onto a status.
 */
const lockOwnedBoard = async (
  tx: BoardTransaction,
  boardId: string,
  ownerId: string
): Promise<BoardLock> => {
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

  return { status: 'locked' };
};

/**
 * Inserts a fresh token through a savepoint, retrying a unique collision so the
 * caller's transaction is never aborted by an already-revoked token. Bounded:
 * three collisions is treated as a surfaced failure, not an endless loop.
 */
const insertFreshToken = async (
  tx: BoardTransaction,
  boardId: string
): Promise<string> => {
  let collision: unknown;

  for (let attempt = 0; attempt < TOKEN_ATTEMPTS; attempt += 1) {
    const token = tokenOf();

    try {
      // biome-ignore lint/performance/noAwaitInLoops: each retry must see the previous collision before minting the next token.
      await tx.transaction(async (savepoint) => {
        await savepoint.insert(shareLink).values({ boardId, token });
      });

      return token;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      collision = error;
    }
  }

  throw new ShareTokenError({ cause: collision });
};

/**
 * Reads the board's live share token for its owner in one joined query. A board
 * with no remote copy has nothing to share, and a board owned by someone else
 * is refused before a token is returned.
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
    .select({ ownerId: board.ownerId, token: shareLink.token })
    .from(board)
    .leftJoin(
      shareLink,
      and(eq(shareLink.boardId, board.id), isNull(shareLink.revokedAt))
    )
    .where(eq(board.id, boardId))
    .limit(1);

  if (stored === undefined) {
    return { status: 'not-linked' };
  }
  if (stored.ownerId !== ownerId) {
    return { status: 'forbidden' };
  }

  return stored.token === null
    ? { status: 'none' }
    : { status: 'live', token: stored.token };
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
    const locked = await lockOwnedBoard(tx, boardId, ownerId);

    if (locked.status !== 'locked') {
      return locked;
    }

    return { status: 'live', token: await insertFreshToken(tx, boardId) };
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
    const locked = await lockOwnedBoard(tx, boardId, ownerId);

    return locked.status === 'locked' ? { status: 'none' } : locked;
  });
};

/**
 * The board a live token names, read without a session. A revoked or unknown
 * token resolves to null, so a visitor sees a readable page rather than a
 * crash; the payload is the latest committed revision, never a cached copy.
 * A server without accounts also answers null, which is a deliberate
 * degradation rather than a failure.
 */
export const resolveShareLink = async (
  token: string
): Promise<Board | null> => {
  if (token === '') {
    return null;
  }

  let db: Database;

  try {
    db = database();
  } catch (error) {
    if (error instanceof ShareConfigurationError) {
      return null;
    }

    throw error;
  }

  const [row] = await db
    .select({ payload: board.payload })
    .from(shareLink)
    .innerJoin(board, eq(board.id, shareLink.boardId))
    .where(and(eq(shareLink.token, token), isNull(shareLink.revokedAt)))
    .limit(1);

  return row?.payload ?? null;
};
