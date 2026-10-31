import { SCHEMA_VERSION } from '@kiyora/model';
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { expect, request, test } from '@playwright/test';
import { E2E_BASE_URL } from '../e2e-server';
import { resetAccounts } from './reset';

const PASSWORD = 'correct-horse-battery';
const BOARD_ID = '99999999-9999-4999-8999-999999999999';

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'green',
  fillStyle: 'outline',
  stroke: 'green',
  strokeWidth: 2,
} as const;

const FIRST_PAINT = 'M 40 40 L 160 40 L 160 120 L 40 120 Z';
const SECOND_PAINT = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';

type Shape = {
  h: number;
  id: string;
  kind: 'rectangle';
  locked: boolean;
  opacity: number;
  parentId: null;
  rotation: number;
  style: typeof STYLE;
  w: number;
  x: number;
  y: number;
};

const rectangle = (id: string, x: number, y: number): Shape => ({
  h: id === 'second' ? 150 : 80,
  id,
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: STYLE,
  w: id === 'second' ? 200 : 120,
  x,
  y,
});

const board = (shapes: Shape[], theme: 'light' | 'dark' = 'dark'): object => ({
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  files: {},
  id: BOARD_ID,
  schemaVersion: SCHEMA_VERSION,
  settings: { theme },
  shapes,
  title: 'Shared board',
  updatedAt: 1_700_000_000_000,
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
  baseRevision: number | null,
  payload: object
) =>
  context.post(`/api/boards/${BOARD_ID}/sync`, {
    data: { baseRevision, payload },
    headers: { origin: E2E_BASE_URL },
  });

const readShare = (context: APIRequestContext) =>
  context.get(`/api/boards/${BOARD_ID}/share`);

const createShare = (context: APIRequestContext) =>
  context.post(`/api/boards/${BOARD_ID}/share`, {
    headers: { origin: E2E_BASE_URL },
  });

const revokeShare = (context: APIRequestContext) =>
  context.delete(`/api/boards/${BOARD_ID}/share`, {
    headers: { origin: E2E_BASE_URL },
  });

const tokenOf = async (response: APIResponse): Promise<string> => {
  const { token } = (await response.json()) as { token?: unknown };

  if (typeof token !== 'string') {
    throw new Error('the response carried no token');
  }

  return token;
};

const htmlAt = async (path: string): Promise<string> => {
  const anonymous = await request.newContext({ baseURL: E2E_BASE_URL });
  const response = await anonymous.get(path);
  expect(response.status()).toBe(200);
  const html = await response.text();
  await anonymous.dispose();

  return html;
};

const syncedBoard = async (
  shapes: Shape[] = [rectangle('first', 40, 40)]
): Promise<APIRequestContext> => {
  const owner = await signUp('owner@kiyora.test');
  const created = await sync(owner, null, board(shapes));
  expect(created.status()).toBe(200);

  return owner;
};

const API_REQUESTS: string[] = [];

const watchApi = (page: Page): void => {
  page.on('request', (event) => {
    if (new URL(event.url()).pathname.startsWith('/api/')) {
      API_REQUESTS.push(event.url());
    }
  });
};

test.beforeEach(async () => {
  API_REQUESTS.length = 0;
  await resetAccounts();
});

test('create returns an unguessable token, and a second create revokes the first', async () => {
  const owner = await syncedBoard();

  const first = await createShare(owner);
  expect(first.ok()).toBe(true);
  const firstToken = await tokenOf(first);
  expect(firstToken).toMatch(/^[A-Za-z0-9_-]{22}$/);

  const read = await readShare(owner);
  expect(read.ok()).toBe(true);
  expect(await tokenOf(read)).toBe(firstToken);

  const second = await createShare(owner);
  expect(second.ok()).toBe(true);
  const secondToken = await tokenOf(second);
  expect(secondToken).not.toBe(firstToken);

  expect(await htmlAt(`/s/${firstToken}`)).toContain(
    'data-testid="share-unavailable"'
  );
  expect(await htmlAt(`/s/${secondToken}`)).toContain(
    'data-testid="share-board"'
  );

  const revoked = await revokeShare(owner);
  expect(revoked.ok()).toBe(true);
  expect(await htmlAt(`/s/${secondToken}`)).toContain(
    'data-testid="share-unavailable"'
  );
});

test('another account can neither create nor read the board share', async () => {
  const owner = await syncedBoard();
  const stranger = await signUp('stranger@kiyora.test');

  expect((await createShare(owner)).ok()).toBe(true);

  expect((await createShare(stranger)).status()).toBe(403);
  expect((await readShare(stranger)).status()).toBe(403);
  expect((await revokeShare(stranger)).status()).toBe(403);

  expect((await readShare(owner)).ok()).toBe(true);
});

test('an unknown token is a readable page, not a crash', async () => {
  const html = await htmlAt('/s/not-a-token');

  expect(html).toContain('data-testid="share-unavailable"');
  expect(html).toContain('This link is not available');
});

test('a signed-out visitor paints the latest committed board in its theme, read-only', async ({
  browser,
}) => {
  const owner = await syncedBoard();
  const token = await tokenOf(await createShare(owner));
  const visitor = await browser.newContext();
  const page = await visitor.newPage();
  watchApi(page);

  await page.goto(`${E2E_BASE_URL}/s/${token}`);
  await expect(
    page.getByTestId('share-board').locator(`path[d="${FIRST_PAINT}"]`)
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByTestId('share-board').locator(`path[stroke="#8ce99a"]`)
  ).toBeVisible();
  await expect(page.getByTestId('share-surface')).toHaveCSS(
    'background-color',
    'rgb(30, 30, 30)'
  );

  await expect(page.getByTestId('tool-rail')).toHaveCount(0);
  await expect(page.getByTestId('save-status')).toHaveCount(0);
  await expect(page.getByTestId('sync-status')).toHaveCount(0);
  await expect(page.getByTestId('board-title')).toHaveCount(0);

  const box = await page.getByTestId('share-board').boundingBox();
  if (box === null) {
    throw new Error('the shared board has no box');
  }
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.up();

  await page.reload();
  await expect(
    page.getByTestId('share-board').locator(`path[d="${FIRST_PAINT}"]`)
  ).toBeVisible();
  await expect(
    page.getByTestId('share-board').locator(`path[d="${SECOND_PAINT}"]`)
  ).toHaveCount(0);

  const second = await sync(
    owner,
    1,
    board([rectangle('first', 40, 40), rectangle('second', 200, 150)])
  );
  expect(second.status()).toBe(200);

  await page.reload();
  await expect(
    page.getByTestId('share-board').locator(`path[d="${SECOND_PAINT}"]`)
  ).toBeVisible();

  expect(API_REQUESTS).toEqual([]);

  await visitor.close();
});

test('regenerating moves the address and revoking stops it resolving', async ({
  browser,
}) => {
  const owner = await syncedBoard();
  const firstToken = await tokenOf(await createShare(owner));
  const secondToken = await tokenOf(await createShare(owner));
  const visitor = await browser.newContext();
  const page = await visitor.newPage();

  await page.goto(`${E2E_BASE_URL}/s/${firstToken}`);
  await expect(page.getByTestId('share-unavailable')).toBeVisible();

  await page.goto(`${E2E_BASE_URL}/s/${secondToken}`);
  await expect(page.getByTestId('share-board')).toBeVisible();

  expect((await revokeShare(owner)).ok()).toBe(true);

  await page.reload();
  await expect(page.getByTestId('share-unavailable')).toBeVisible();

  await visitor.close();
});
