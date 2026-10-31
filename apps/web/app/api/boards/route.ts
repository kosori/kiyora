import { NextResponse } from 'next/server';
import { currentUserId } from '~/lib/auth/session';
import { listBoards } from '~/lib/db/board-store';

/**
 * Every remote copy the signed-in owner holds. The payload is never selected,
 * so listing a hundred boards reads their columns and no board bytes.
 */
export const GET = async (): Promise<Response> => {
  const ownerId = await currentUserId();

  if (ownerId === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ boards: await listBoards(ownerId) });
};
