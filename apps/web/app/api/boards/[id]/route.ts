import { NextResponse } from 'next/server';
import { currentUserId } from '~/lib/auth/session';
import { deleteBoard } from '~/lib/db/board-store';

/**
 * Deletes one board's remote copy. The session is read before the database, so
 * a signed-out delete is a 401 rather than a missing row. A board that is
 * absent or owned by someone else is a 404, and a repeat is a quiet 404, so the
 * client can treat an already-gone remote copy as done.
 */
export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ownerId = await currentUserId();

  if (ownerId === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteBoard({ id, ownerId });

  if (result.status === 'deleted') {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ error: 'not-found' }, { status: 404 });
};
