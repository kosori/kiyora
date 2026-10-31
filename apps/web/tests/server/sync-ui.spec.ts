import type { Page, Route } from '@playwright/test';
import { E2E_BASE_URL } from '../e2e-server';
import {
  openBoard,
  readStoredBoard,
  readStoredKey,
  seedBoards,
} from '../fixtures/library';
import { expect, test } from '../fixtures/offline';
import { resetAccounts } from './reset';

const EMAIL = 'sync@kiyora.test';
const PASSWORD = 'correct-horse-battery';
const NAME = 'Sync Account';

const LINKED_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_ID = '55555555-5555-4555-8555-555555555555';

const drawnPaint = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';

type Upload = {
  baseRevision: number | null;
  payload: {
    id: string;
    shapes: { kind?: string; x?: number }[];
    title: string;
  };
};

type Reply = {
  status?: number;
  body: unknown;
};

const uploads: Upload[] = [];
let replies: Reply[] = [];

/** Answers the sync route with a scripted reply and records the request body. */
const answerSync = async (route: Route): Promise<void> => {
  const request = route.request();
  uploads.push(request.postDataJSON() as Upload);
  const reply = replies.shift() ?? { body: { revision: 1 }, status: 200 };

  await route.fulfill({ json: reply.body, status: reply.status ?? 200 });
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

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const drawRectangle = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.up();
};

const recordOf = async (page: Page) =>
  JSON.parse((await readStoredKey(page, 'kiyora:library')) ?? 'null') as {
    boards: {
      id: string;
      linked?: boolean;
      revision?: number;
      conflict?: number;
    }[];
  };

test.beforeEach(async () => {
  await resetAccounts();
  uploads.length = 0;
  replies = [];
});

test.use({ offlineMode: 'none' });

test('signing in uploads nothing until the board is linked, then it uploads once', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/*/sync', answerSync);
  await openBoard(page, { id: LINKED_ID, title: 'Linked' });

  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'local'
  );
  expect(uploads).toEqual([]);

  await page.getByTestId('link-board').click();

  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-revision',
    '1'
  );
  expect(uploads).toHaveLength(1);
  expect(uploads[0]?.baseRevision).toBeNull();
  expect(uploads[0]?.payload.id).toBe(LINKED_ID);

  const entry = (await recordOf(page)).boards.find(
    (board) => board.id === LINKED_ID
  );
  expect(entry).toMatchObject({ linked: true, revision: 1 });
});

test('a later save uploads the next revision with the drawn shape', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/*/sync', answerSync);
  await openBoard(page, { id: LINKED_ID, title: 'Linked' });

  await page.getByTestId('link-board').click();
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );

  replies.push({ body: { revision: 2 }, status: 200 });
  await drawRectangle(page);

  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-revision',
    '2'
  );
  expect(uploads).toHaveLength(2);
  expect(uploads[1]?.baseRevision).toBe(1);
  expect(
    uploads[1]?.payload.shapes.some(
      (shape) => shape.kind === 'rectangle' && shape.x === 200
    )
  ).toBe(true);
});

test('linking one board never uploads another', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/boards/*/sync', answerSync);
  await seedBoards(
    page,
    [
      { id: LINKED_ID, title: 'Linked' },
      { id: OTHER_ID, title: 'Other' },
    ],
    { open: `/b/${LINKED_ID}` }
  );

  await page.getByTestId('link-board').click();
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );

  await page.goto(`/b/${OTHER_ID}`);
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'local'
  );

  await drawRectangle(page);
  await expect(
    page.getByTestId('board').locator(`path[d="${drawnPaint}"]`)
  ).toBeVisible();

  expect(uploads).toHaveLength(1);
});

test('a stale write shows a conflict and never overwrites the local board', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/*/sync', answerSync);
  await openBoard(page, { id: LINKED_ID, title: 'Linked' });

  await page.getByTestId('link-board').click();
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );

  const remote = {
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    files: {},
    id: LINKED_ID,
    schemaVersion: 3,
    settings: { theme: 'light' },
    shapes: [],
    title: 'Remote',
    updatedAt: 1_700_000_000_100,
  };
  replies.push({ body: { payload: remote, revision: 7 }, status: 409 });

  await drawRectangle(page);

  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'conflict'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-remote',
    '7'
  );
  await expect(
    page.getByTestId('board').locator(`path[d="${drawnPaint}"]`)
  ).toBeVisible();

  const stored = JSON.parse((await readStoredBoard(page, LINKED_ID)) ?? '{}');
  expect(stored.title).toBe('Linked');
  expect(
    stored.shapes.some(
      (shape: { kind?: string; x?: number }) =>
        shape.kind === 'rectangle' && shape.x === 200
    )
  ).toBe(true);

  const record = await recordOf(page);
  expect(record.boards.find((board) => board.id === LINKED_ID)).toMatchObject({
    conflict: 7,
    linked: true,
    revision: 1,
  });
});
