import { NextResponse } from 'next/server';
import { currentUserId } from '~/lib/auth/session';
import { writeBoard } from '~/lib/db/board-store';

type Body = {
  baseRevision: number | null;
  payload: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readBody = (value: unknown): Body | null => {
  if (!(isObject(value) && 'payload' in value)) {
    return null;
  }

  const { baseRevision } = value;

  if (
    baseRevision !== null &&
    !(
      typeof baseRevision === 'number' &&
      Number.isInteger(baseRevision) &&
      baseRevision >= 0
    )
  ) {
    return null;
  }

  return { baseRevision, payload: value.payload };
};

/**
 * Writes one board's remote copy. The session is read here, server-side, so a
 * signed-out client is refused before the database is touched; the revision
 * check and the payload validation live in `@kiyora/sync`, and this only maps
 * the decision onto a status code.
 */
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ownerId = await currentUserId();

  if (ownerId === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (id.length === 0) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  let body: Body | null;
  try {
    body = readBody(await request.json());
  } catch {
    body = null;
  }

  if (body === null) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const result = await writeBoard({
    baseRevision: body.baseRevision,
    id,
    ownerId,
    payload: body.payload,
  });

  if (result.status === 'written') {
    return NextResponse.json({ revision: result.revision });
  }

  if (result.status === 'conflict') {
    return NextResponse.json(
      { payload: result.payload, revision: result.revision },
      { status: 409 }
    );
  }

  if (result.status === 'too-large') {
    return NextResponse.json(
      { bytes: result.bytes, limit: result.limit },
      { status: 413 }
    );
  }

  if (result.status === 'forbidden') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json(
    { error: 'invalid', reason: result.reason },
    { status: 400 }
  );
};
