import type { BoardPage } from '@kiyora/sync';
import { NextResponse } from 'next/server';
import { currentUserId } from '~/lib/auth/session';
import { listBoards } from '~/lib/db/board-store';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** A non-negative integer query value, or `null` when it is not one. */
const readCount = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const count = Number(value);

  return Number.isSafeInteger(count) ? count : null;
};

/**
 * The requested page, clamped to what the route will read: `limit` defaults to
 * 50 and is held between 1 and 100, `offset` defaults to 0. A value that is not
 * a non-negative integer is refused rather than guessed at.
 */
const readPage = (params: URLSearchParams): BoardPage | null => {
  const limit = readCount(params.get('limit'));
  const offset = readCount(params.get('offset'));

  if (
    (params.has('limit') && limit === null) ||
    (params.has('offset') && offset === null)
  ) {
    return null;
  }

  return {
    limit: Math.min(MAX_LIMIT, Math.max(1, limit ?? DEFAULT_LIMIT)),
    offset: offset ?? 0,
  };
};

/**
 * One page of every remote copy the signed-in owner holds, plus the account's
 * whole count. The payload is never selected, so listing a hundred boards reads
 * their columns and no board bytes.
 */
export const GET = async (request: Request): Promise<Response> => {
  const ownerId = await currentUserId();

  if (ownerId === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const page = readPage(new URL(request.url).searchParams);

  if (page === null) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const { boards, total } = await listBoards(ownerId, page);

  return NextResponse.json({ boards, total });
};
