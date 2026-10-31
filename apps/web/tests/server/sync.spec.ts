import { SCHEMA_VERSION } from '@kiyora/model';
import type { APIRequestContext } from '@playwright/test';
import { expect, request, test } from '@playwright/test';
import postgres from 'postgres';
import { E2E_BASE_URL, E2E_DATABASE_URL } from '../e2e-server';
import { resetAccounts } from './reset';

const PASSWORD = 'correct-horse-battery';
const BOARD_ID = '11111111-1111-4111-8111-111111111111';
const MIB = 1024 * 1024;
const SYNC_LIMIT = 4 * MIB;

const payload = (overrides: Record<string, unknown> = {}): object => ({
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  files: {},
  id: BOARD_ID,
  schemaVersion: SCHEMA_VERSION,
  settings: { theme: 'light' },
  shapes: [],
  title: 'Board',
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

const signUp = async (email: string): Promise<APIRequestContext> => {
  const context = await request.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: { origin: E2E_BASE_URL },
  });
  const response = await context.post('/api/auth/sign-up/email', {
    data: { email, name: email, password: PASSWORD },
  });

  expect(response.ok(), `signing up ${email}`).toBe(true);

  return context;
};

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'green',
  fillStyle: 'bold',
  stroke: 'green',
  strokeWidth: 2,
} as const;

const PREVIEW_LIMIT = 32 * 1024;

const sync = (
  context: APIRequestContext,
  body: {
    baseRevision: number | null;
    payload: unknown;
    preview?: string | null;
  }
) =>
  context.post(`/api/boards/${BOARD_ID}/sync`, {
    data: body,
    headers: { origin: E2E_BASE_URL },
  });

/** One board whose only shape carries a label, so painting it needs a measurer. */
const labelled = (overrides: Record<string, unknown> = {}): object =>
  payload({
    shapes: [
      {
        h: 80,
        id: 'rectangle',
        kind: 'rectangle',
        locked: false,
        opacity: 1,
        parentId: null,
        rotation: 0,
        style: STYLE,
        text: 'Label',
        w: 120,
        x: 40,
        y: 40,
      },
    ],
    ...overrides,
  });

/** One board carrying a raster whose encoded bytes push it over the sync limit. */
const oversized = (): object =>
  payload({
    files: {
      huge: {
        bytes: 1,
        dataURL: `data:image/png;base64,${'A'.repeat(4.2 * MIB)}`,
        mime: 'image/png',
      },
    },
  });

const storedRow = async () => {
  const client = postgres(E2E_DATABASE_URL, { max: 1 });

  try {
    const [row] = await client<
      {
        bytes: number;
        owner_id: string;
        payload_hash: string;
        preview_svg: string | null;
        revision: number;
        title: string;
      }[]
    >`select bytes, owner_id, payload_hash, preview_svg, revision, title
        from board where id = ${BOARD_ID}`;
    return row;
  } finally {
    await client.end();
  }
};

/** The committed row, failing the test rather than reading through undefined. */
const committedRow = async () => {
  const row = await storedRow();

  if (row === undefined) {
    throw new Error('the board row is missing');
  }

  return row;
};

test.beforeEach(async () => {
  await resetAccounts();
});

test('creates revision 1, accepts the next, and does not bump a retry', async () => {
  const owner = await signUp('owner@kiyora.test');

  const created = await sync(owner, { baseRevision: null, payload: payload() });
  expect(created.status()).toBe(200);
  await expect(created.json()).resolves.toEqual({ revision: 1 });

  const retried = await sync(owner, {
    baseRevision: 1,
    payload: payload(),
  });
  expect(retried.status()).toBe(200);
  await expect(retried.json()).resolves.toEqual({ revision: 1 });

  const second = payload({ title: 'Second', updatedAt: 1_700_000_000_001 });
  const accepted = await sync(owner, { baseRevision: 1, payload: second });
  expect(accepted.status()).toBe(200);
  await expect(accepted.json()).resolves.toEqual({ revision: 2 });

  const secondRetry = await sync(owner, {
    baseRevision: 2,
    payload: second,
  });
  expect(secondRetry.status()).toBe(200);
  await expect(secondRetry.json()).resolves.toEqual({ revision: 2 });

  const row = await committedRow();
  expect(row.title).toBe('Second');
  expect(row.revision).toBe(2);
  expect(row.bytes).toBe(Buffer.byteLength(JSON.stringify(second), 'utf8'));
  expect(row.payload_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(row.preview_svg).toBeNull();
});

test('stores the preview the client sent, and none when it sent none', async () => {
  const owner = await signUp('preview@kiyora.test');

  const without = await sync(owner, {
    baseRevision: null,
    payload: labelled(),
  });
  expect(without.status()).toBe(200);
  expect((await committedRow()).preview_svg).toBeNull();

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
  const withPreview = await sync(owner, {
    baseRevision: 1,
    payload: labelled({ title: 'With preview', updatedAt: 1_700_000_000_001 }),
    preview: svg,
  });
  expect(withPreview.status()).toBe(200);
  expect((await committedRow()).preview_svg).toBe(svg);

  const malformed = await sync(owner, {
    baseRevision: 2,
    payload: labelled({ title: 'Malformed', updatedAt: 1_700_000_000_002 }),
    preview: 'not an svg',
  });
  expect(malformed.status()).toBe(200);
  expect((await committedRow()).preview_svg).toBeNull();

  const oversized = await sync(owner, {
    baseRevision: 3,
    payload: labelled({ title: 'Oversized', updatedAt: 1_700_000_000_003 }),
    preview: `<svg>${'a'.repeat(PREVIEW_LIMIT)}</svg>`,
  });
  expect(oversized.status()).toBe(200);
  expect((await committedRow()).preview_svg).toBeNull();
});

test('refuses a stale write and carries the remote copy back', async () => {
  const owner = await signUp('stale@kiyora.test');
  const remote = payload({ title: 'Remote', updatedAt: 1_700_000_000_001 });

  await sync(owner, { baseRevision: null, payload: payload() });
  await sync(owner, { baseRevision: 1, payload: remote });

  const stale = payload({ title: 'Mine', updatedAt: 1_700_000_000_002 });
  const refused = await sync(owner, { baseRevision: 1, payload: stale });

  expect(refused.status()).toBe(409);
  const body = (await refused.json()) as {
    payload: { title: string };
    revision: number;
  };
  expect(body.revision).toBe(2);
  expect(body.payload.title).toBe('Remote');

  const moved = await sync(owner, { baseRevision: 2, payload: stale });
  expect(moved.status()).toBe(200);
  await expect(moved.json()).resolves.toEqual({ revision: 3 });

  const row = await committedRow();
  expect(row.revision).toBe(3);
  expect(row.title).toBe('Mine');
  expect(row.bytes).toBe(Buffer.byteLength(JSON.stringify(stale), 'utf8'));
});

test('refuses a board over the sync limit with the numbers', async () => {
  const owner = await signUp('large@kiyora.test');
  const board = oversized();

  const response = await sync(owner, { baseRevision: null, payload: board });

  expect(response.status()).toBe(413);
  const body = (await response.json()) as { bytes: number; limit: number };
  expect(body.limit).toBe(SYNC_LIMIT);
  expect(body.bytes).toBeGreaterThan(SYNC_LIMIT);
  expect(await storedRow()).toBeUndefined();
});

test('refuses a payload the schema rejects and one from another version', async () => {
  const owner = await signUp('invalid@kiyora.test');

  const malformed = await sync(owner, {
    baseRevision: null,
    payload: payload({ shapes: 'not a list' }),
  });
  expect(malformed.status()).toBe(400);

  const stale = await sync(owner, {
    baseRevision: null,
    payload: payload({ schemaVersion: SCHEMA_VERSION - 1 }),
  });
  expect(stale.status()).toBe(400);

  expect(await storedRow()).toBeUndefined();
});

test('refuses a signed-out write before the database is touched', async () => {
  const anonymous = await request.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: { origin: E2E_BASE_URL },
  });

  const response = await sync(anonymous, {
    baseRevision: null,
    payload: payload(),
  });

  expect(response.status()).toBe(401);
  expect(await storedRow()).toBeUndefined();
});

test('a second account cannot write the first account board', async () => {
  const owner = await signUp('first@kiyora.test');
  const stranger = await signUp('second@kiyora.test');

  await sync(owner, { baseRevision: null, payload: payload() });

  const created = await sync(stranger, {
    baseRevision: null,
    payload: payload({ title: 'Stolen' }),
  });
  expect(created.status()).toBe(403);

  const overwritten = await sync(stranger, {
    baseRevision: 1,
    payload: payload({ title: 'Stolen' }),
  });
  expect(overwritten.status()).toBe(403);

  const ownerStillWrites = await sync(owner, {
    baseRevision: 1,
    payload: payload({ title: 'Owner', updatedAt: 1_700_000_000_009 }),
  });
  expect(ownerStillWrites.status()).toBe(200);
  await expect(ownerStillWrites.json()).resolves.toEqual({ revision: 2 });

  const row = await committedRow();
  expect(row.title).toBe('Owner');
  expect(row.revision).toBe(2);
});
