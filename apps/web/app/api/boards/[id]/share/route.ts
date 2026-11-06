import { NextResponse } from 'next/server';
import { currentUserId } from '~/lib/auth/session';
import {
  createShareLink,
  readShareLink,
  revokeShareLink,
  ShareConfigurationError,
  type ShareLinkLookup,
} from '~/lib/db/share-store';

const answer = (lookup: ShareLinkLookup): Response => {
  if (lookup.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (lookup.status === 'not-linked') {
    return NextResponse.json({ error: 'not-linked' }, { status: 404 });
  }
  if (lookup.status === 'live') {
    return NextResponse.json({ token: lookup.token });
  }

  return NextResponse.json({ token: null });
};

/** Runs one share action; a server without accounts answers 503, not a 500. */
const answerWith = async (
  work: () => Promise<ShareLinkLookup>
): Promise<Response> => {
  try {
    return answer(await work());
  } catch (error) {
    if (error instanceof ShareConfigurationError) {
      return NextResponse.json({ error: 'unavailable' }, { status: 503 });
    }

    throw error;
  }
};

/**
 * The board's one share link. The owner is read from the session before the
 * database is touched, so a signed-out request is refused and another account
 * cannot learn whether a board has a live address.
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

  return answerWith(() => readShareLink({ boardId: id, ownerId }));
};

/**
 * Creates a share link, revoking the board's previous live token first. One
 * board never has two live addresses.
 */
export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> => {
  const ownerId = await currentUserId();

  if (ownerId === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  return answerWith(() => createShareLink({ boardId: id, ownerId }));
};

/** Revokes the board's live share link. The remote copy itself is untouched. */
export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> => {
  const ownerId = await currentUserId();

  if (ownerId === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  return answerWith(() => revokeShareLink({ boardId: id, ownerId }));
};
