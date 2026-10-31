import { SCHEMA_VERSION } from '@kiyora/model';
import type { APIRequestContext, Page, Route } from '@playwright/test';
import { request } from '@playwright/test';
import postgres from 'postgres';
import { E2E_BASE_URL, E2E_DATABASE_URL } from '../e2e-server';
import {
  openLibrary,
  readStoredBoard,
  readStoredKey,
  type SeededBoard,
} from '../fixtures/library';
import { expect, test } from '../fixtures/offline';
import { resetAccounts } from './reset';

const PASSWORD = 'correct-horse-battery';
const NAME = 'Delete Account';
const EMAIL = 'delete@kiyora.test';

const BOARD_ID = '66666666-6666-4666-8666-666666666666';
const LINKED_ID = '77777777-7777-4777-8777-777777777777';
const LOCAL_ID = '88888888-8888-4888-8888-888888888888';
const KEPT_ID = '99999999-9999-4999-8999-999999999999';

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

const sync = (context: APIRequestContext, body: unknown) =>
  context.post(`/api/boards/${BOARD_ID}/sync`, {
    data: body,
    headers: { origin: E2E_BASE_URL },
  });

const remove = (context: APIRequestContext, id = BOARD_ID) =>
  context.delete(`/api/boards/${id}`, {
    headers: { origin: E2E_BASE_URL },
  });

const storedRow = async () => {
  const client = postgres(E2E_DATABASE_URL, { max: 1 });

  try {
    const [row] = await client<
      { id: string; owner_id: string }[]
    >`select id, owner_id from board where id = ${BOARD_ID}`;
    return row;
  } finally {
    await client.end();
  }
};

const link = async (owner: APIRequestContext): Promise<void> => {
  const created = await sync(owner, {
    baseRevision: null,
    payload: payload(),
  });

  expect(created.status()).toBe(200);
};

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const pathOf = (x: number): string =>
  `M ${x} 0 L ${x + 120} 0 L ${x + 120} 80 L ${x} 80 Z`;

const board = (
  id: string,
  title: string,
  updatedAt: number,
  linked: boolean
): SeededBoard => ({
  id,
  shapes: [
    {
      h: 80,
      id: `shape-${id}`,
      kind: 'rectangle',
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: STYLE,
      w: 120,
      x: 0,
      y: 0,
    },
  ],
  sync: linked ? { linked: true, revision: 3 } : undefined,
  title,
  updatedAt,
});

type Upload = {
  baseRevision: number | null;
  payload: { id: string };
};

const deletes: string[] = [];
const uploads: Upload[] = [];
let deleteReplies: number[] = [];

/** Answers the delete route from a script and records the sync uploads beside it. */
const answerBoards = async (route: Route): Promise<void> => {
  const incoming = route.request();

  if (incoming.method() === 'DELETE') {
    deletes.push(new URL(incoming.url()).pathname);
    const status = deleteReplies.shift() ?? 204;

    await route.fulfill({ body: '', status });
    return;
  }

  uploads.push(incoming.postDataJSON() as Upload);
  await route.fulfill({ json: { revision: 4 }, status: 200 });
};

const signIn = async (page: Page): Promise<void> => {
  const created = await page.request.post('/api/auth/sign-up/email', {
    data: { email: EMAIL, name: NAME, password: PASSWORD },
    headers: { origin: E2E_BASE_URL },
  });

  expect(created.ok()).toBe(true);

  const signedIn = await page.request.post('/api/auth/sign-in/email', {
    data: { email: EMAIL, password: PASSWORD },
    headers: { origin: E2E_BASE_URL },
  });

  expect(signedIn.ok()).toBe(true);
};

const recordOf = async (page: Page) =>
  JSON.parse((await readStoredKey(page, 'kiyora:library')) ?? 'null') as {
    boards: { id: string; linked?: boolean; revision?: number }[];
  };

const rowOf = (page: Page, title: string) =>
  page.getByTestId('library-row').filter({ hasText: title });

const drawRectangle = async (page: Page): Promise<void> => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  await page.keyboard.press('r');
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.up();
};

test.beforeEach(async () => {
  await resetAccounts();
  deletes.length = 0;
  uploads.length = 0;
  deleteReplies = [];
});

test('deletes the remote row, and a second delete is a quiet 404', async () => {
  const owner = await signUp('delete@kiyora.test');
  await link(owner);

  const deleted = await remove(owner);
  expect(deleted.status()).toBe(204);
  expect(await storedRow()).toBeUndefined();

  const again = await remove(owner);
  expect(again.status()).toBe(404);
});

test('another account cannot delete the board, and the row survives', async () => {
  const owner = await signUp('owner@kiyora.test');
  const stranger = await signUp('stranger@kiyora.test');
  await link(owner);

  const refused = await remove(stranger);
  expect([403, 404]).toContain(refused.status());

  const row = await storedRow();
  expect(row?.id).toBe(BOARD_ID);
  expect(row?.owner_id).not.toBeUndefined();
});

test('a signed-out delete is refused before the row is touched', async () => {
  const owner = await signUp('signed-out@kiyora.test');
  await link(owner);

  const anonymous = await request.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: { origin: E2E_BASE_URL },
  });

  const refused = await remove(anonymous);
  expect(refused.status()).toBe(401);

  expect((await storedRow())?.id).toBe(BOARD_ID);
});

test.use({ offlineMode: 'none' });

test('the linked confirm names the account and both copies, and cancelling keeps both', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/**', answerBoards);
  await openLibrary(page, [board(LINKED_ID, 'Linked', 2000, true)]);

  await rowOf(page, 'Linked').getByTestId('delete-board').click();
  const dialog = page.getByTestId('delete-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(NAME);
  await expect(dialog).toContainText('local copy');
  await expect(dialog).toContainText('remote copy');

  await dialog.getByTestId('cancel-delete').click();
  await expect(dialog).toBeHidden();
  expect(deletes).toEqual([]);
  expect(await readStoredBoard(page, LINKED_ID)).not.toBeNull();

  const record = await recordOf(page);
  expect(record.boards.find(({ id }) => id === LINKED_ID)).toMatchObject({
    linked: true,
    revision: 3,
  });

  await rowOf(page, 'Linked').getByTestId('library-board').click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
  await expect(
    page.getByTestId('board').locator(`path[d="${pathOf(0)}"]`)
  ).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );

  await drawRectangle(page);
  await expect
    .poll(() => uploads.filter(({ baseRevision }) => baseRevision === 3).length)
    .toBe(1);
});

test('confirming deletes the remote row and the local bytes', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/**', answerBoards);
  await openLibrary(page, [
    board(LINKED_ID, 'Linked', 2000, true),
    board(KEPT_ID, 'Kept', 1000, false),
  ]);

  await rowOf(page, 'Linked').getByTestId('delete-board').click();
  await page.getByTestId('delete-dialog').getByTestId('confirm-delete').click();

  await expect(rowOf(page, 'Linked')).toBeHidden();
  await expect.poll(() => readStoredBoard(page, LINKED_ID)).toBeNull();
  expect(deletes).toEqual([`/api/boards/${LINKED_ID}`]);

  const kept = (await recordOf(page)).boards.map(({ id }) => id);
  expect(kept).toEqual([KEPT_ID]);
  const keptBytes = await readStoredBoard(page, KEPT_ID);
  expect(JSON.parse(keptBytes ?? '{}').shapes).toHaveLength(1);
});

test('a failed remote delete keeps the local copy, shows the error, and retries', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/**', answerBoards);
  await openLibrary(page, [board(LINKED_ID, 'Linked', 2000, true)]);
  deleteReplies = [500, 204];

  await rowOf(page, 'Linked').getByTestId('delete-board').click();
  const dialog = page.getByTestId('delete-dialog');
  await dialog.getByTestId('confirm-delete').click();

  await expect(page.getByTestId('delete-error')).toContainText('remote copy');
  await expect(dialog).toBeVisible();
  expect(await readStoredBoard(page, LINKED_ID)).not.toBeNull();
  expect((await recordOf(page)).boards.map(({ id }) => id)).toEqual([
    LINKED_ID,
  ]);
  expect(deletes).toHaveLength(1);

  await dialog.getByTestId('confirm-delete').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => readStoredBoard(page, LINKED_ID)).toBeNull();
  expect(deletes).toHaveLength(2);
  expect((await recordOf(page)).boards).toEqual([]);
});

test('a remote copy that is already gone still allows the local delete', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/**', answerBoards);
  await openLibrary(page, [board(LINKED_ID, 'Linked', 2000, true)]);
  deleteReplies = [404];

  await rowOf(page, 'Linked').getByTestId('delete-board').click();
  const dialog = page.getByTestId('delete-dialog');
  await dialog.getByTestId('confirm-delete').click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('delete-error')).toBeHidden();
  await expect.poll(() => readStoredBoard(page, LINKED_ID)).toBeNull();
  expect(deletes).toEqual([`/api/boards/${LINKED_ID}`]);
  expect((await recordOf(page)).boards).toEqual([]);
});

test('a local-only board keeps the current wording and never calls the server', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/**', answerBoards);
  await openLibrary(page, [board(LOCAL_ID, 'Local', 1000, false)]);

  await rowOf(page, 'Local').getByTestId('delete-board').click();
  const dialog = page.getByTestId('delete-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('remote copy');
  await expect(dialog).toContainText('removed from this browser');

  await dialog.getByTestId('confirm-delete').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => readStoredBoard(page, LOCAL_ID)).toBeNull();
  expect(deletes).toEqual([]);
});
