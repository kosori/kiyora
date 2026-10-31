import { NextResponse } from 'next/server';
import { currentUserId } from '~/lib/auth/session';
import { readBoard } from '~/lib/db/board-store';

/**
 * One remote copy's payload and revision, for its owner only. A board another
 * account owns answers `404`, the same as one that does not exist, so the
 * endpoint never confirms an id it will not serve.
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> => {
  const ownerId = await currentUserId();

  if (ownerId === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const stored = id.length === 0 ? null : await readBoard({ id, ownerId });

  if (stored === null) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  return NextResponse.json(stored);
};
