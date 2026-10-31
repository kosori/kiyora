import { SCHEMA_VERSION } from '@kiyora/model';
import type { APIRequestContext } from '@playwright/test';
import { expect, request, test } from '@playwright/test';
import postgres from 'postgres';
import { E2E_BASE_URL, E2E_DATABASE_URL } from '../e2e-server';
import { resetAccounts } from './reset';

const PASSWORD = 'correct-horse-battery';

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'green',
  fillStyle: 'bold',
  stroke: 'green',
  strokeWidth: 2,
} as const;

const PREVIEW =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#8bc34a"/></svg>';

const payload = (
  id: string,
  overrides: Record<string, unknown> = {}
): object => ({
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  files: {},
  id,
  schemaVersion: SCHEMA_VERSION,
  settings: { theme: 'light' },
  shapes: [
    {
      h: 80,
      id: `${id}-rectangle`,
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

const sync = (
  context: APIRequestContext,
  id: string,
  body: { baseRevision: number | null; payload: unknown; preview?: string }
) =>
  context.post(`/api/boards/${id}/sync`, {
    data: body,
    headers: { origin: E2E_BASE_URL },
  });

const list = (context: APIRequestContext) =>
  context.get('/api/boards', { headers: { origin: E2E_BASE_URL } });

const download = (context: APIRequestContext, id: string) =>
  context.get(`/api/boards/${id}`, { headers: { origin: E2E_BASE_URL } });

test.beforeEach(async () => {
  await resetAccounts();
});

test('lists only the owner boards, without their payloads', async () => {
  const owner = await signUp('owner@kiyora.test');
  const stranger = await signUp('stranger@kiyora.test');

  const first = payload('11111111-1111-4111-8111-111111111111', {
    title: 'First',
  });
  const second = payload('22222222-2222-4222-8222-222222222222', {
    title: 'Second',
    updatedAt: 1_700_000_000_500,
  });

  expect(
    (
      await sync(owner, '11111111-1111-4111-8111-111111111111', {
        baseRevision: null,
        payload: first,
      })
    ).status()
  ).toBe(200);
  expect(
    (
      await sync(owner, '22222222-2222-4222-8222-222222222222', {
        baseRevision: null,
        payload: second,
        preview: PREVIEW,
      })
    ).status()
  ).toBe(200);
  expect(
    (
      await sync(stranger, '33333333-3333-4333-8333-333333333333', {
        baseRevision: null,
        payload: payload('33333333-3333-4333-8333-333333333333', {
          title: 'Theirs',
        }),
      })
    ).status()
  ).toBe(200);

  const response = await list(owner);
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    boards: {
      id: string;
      title: string;
      revision: number;
      updatedAt: string;
      bytes: number;
      preview: string | null;
      payload?: unknown;
    }[];
  };

  expect(body.boards.map((board) => board.title)).toEqual(['Second', 'First']);
  expect(body.boards[0]).toEqual({
    bytes: Buffer.byteLength(JSON.stringify(second), 'utf8'),
    id: '22222222-2222-4222-8222-222222222222',
    preview: PREVIEW,
    revision: 1,
    title: 'Second',
    updatedAt: expect.any(String),
  });
  expect(Date.parse(body.boards[0]?.updatedAt ?? '')).toBeGreaterThan(0);
  expect(body.boards[1]?.preview).toBeNull();
  expect(JSON.stringify(body)).not.toContain('"shapes"');
  expect(JSON.stringify(body)).not.toContain('"payload"');

  const theirs = (await (await list(stranger)).json()) as {
    boards: { title: string }[];
  };
  expect(theirs.boards.map((board) => board.title)).toEqual(['Theirs']);
});

test('downloads the payload and revision for the owner', async () => {
  const owner = await signUp('download@kiyora.test');
  const id = '44444444-4444-4444-8444-444444444444';
  const board = payload(id, { title: 'Downloaded' });

  expect(
    (await sync(owner, id, { baseRevision: null, payload: board })).status()
  ).toBe(200);

  const response = await download(owner, id);
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    payload: board,
    revision: 1,
  });
});

test('a second account gets 404, not someone else board', async () => {
  const owner = await signUp('first@kiyora.test');
  const stranger = await signUp('second@kiyora.test');
  const id = '55555555-5555-4555-8555-555555555555';

  expect(
    (
      await sync(owner, id, {
        baseRevision: null,
        payload: payload(id, { title: 'Mine' }),
      })
    ).status()
  ).toBe(200);

  const refused = await download(stranger, id);
  expect(refused.status()).toBe(404);
  expect(await refused.text()).not.toContain('Mine');
});

test('refuses a signed-out read before the database is touched', async () => {
  const anonymous = await request.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: { origin: E2E_BASE_URL },
  });

  expect((await list(anonymous)).status()).toBe(401);
  expect(
    (await download(anonymous, '66666666-6666-4666-8666-666666666666')).status()
  ).toBe(401);
});

test('a board deleted remotely is absent from the next listing', async () => {
  const owner = await signUp('deleted@kiyora.test');
  const id = '77777777-7777-4777-8777-777777777777';

  expect(
    (
      await sync(owner, id, {
        baseRevision: null,
        payload: payload(id, { title: 'Gone' }),
      })
    ).status()
  ).toBe(200);

  const first = (await (await list(owner)).json()) as {
    boards: { id: string }[];
  };
  expect(first.boards.map((board) => board.id)).toEqual([id]);

  const client = postgres(E2E_DATABASE_URL, { max: 1 });
  try {
    await client`delete from board where id = ${id}`;
  } finally {
    await client.end();
  }

  const second = (await (await list(owner)).json()) as {
    boards: { id: string }[];
  };
  expect(second.boards).toEqual([]);
});
