import { readFile } from 'node:fs/promises';
import type { Page, Route } from '@playwright/test';
import { E2E_BASE_URL } from '../e2e-server';
import {
  conflictKey,
  openBoard,
  readStoredBoard,
  readStoredKey,
  type SeededBoard,
  seededBoard,
  snapshotKey,
} from '../fixtures/library';
import { expect, test } from '../fixtures/offline';
import { resetAccounts } from './reset';

const EMAIL = 'conflict@kiyora.test';
const PASSWORD = 'correct-horse-battery';
const NAME = 'Conflict Account';

const BOARD_ID = '66666666-6666-4666-8666-666666666666';

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const remoteShape = {
  h: 80,
  id: 'remote-rectangle',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: STYLE,
  w: 120,
  x: 40,
  y: 40,
};

const localPaint = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';
const remotePaint = 'M 40 40 L 160 40 L 160 120 L 40 120 Z';

const remoteSource: SeededBoard = {
  id: BOARD_ID,
  shapes: [remoteShape],
  title: 'Remote board',
  updatedAt: 1_700_000_000_900,
};

const remoteBoard = seededBoard(remoteSource);

type Upload = {
  baseRevision: number | null;
  payload: {
    id: string;
    shapes: { id: string; kind?: string; x?: number }[];
    title: string;
  };
  preview: string | null;
};

type Reply = { status?: number; body: unknown };

const uploads: Upload[] = [];
let replies: Reply[] = [];

const answerSync = async (route: Route): Promise<void> => {
  uploads.push(route.request().postDataJSON() as Upload);
  const reply = replies.shift() ?? { body: { revision: 1 }, status: 200 };
  await route.fulfill({ json: reply.body, status: reply.status ?? 200 });
};

const answerAccepted = (revision: number) => async (route: Route) => {
  uploads.push(route.request().postDataJSON() as Upload);
  await route.fulfill({ json: { revision } });
};

const answerRemoteCopy = async (route: Route): Promise<void> => {
  await route.fulfill({
    json: { payload: remoteBoard, revision: 7 },
  });
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
      conflict?: number;
      id: string;
      linked?: boolean;
      revision?: number;
      title: string;
    }[];
  };

/** Signs in, links the seeded board, then makes the next write meet a stale copy. */
const startConflict = async (page: Page): Promise<void> => {
  await signIn(page);
  await page.route('**/api/boards/*/sync', answerSync);
  await openBoard(page, { id: BOARD_ID, title: 'Linked' });

  await page.getByTestId('link-board').click();
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );

  replies.push({
    body: { payload: remoteBoard, revision: 7 },
    status: 409,
  });
  await drawRectangle(page);

  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'conflict'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-remote',
    '7'
  );
};

test.beforeEach(async () => {
  await resetAccounts();
  uploads.length = 0;
  replies = [];
});

test.use({ offlineMode: 'none' });

test('keep mine uploads the local bytes at the remote revision and shows synced', async ({
  page,
}) => {
  await startConflict(page);
  await page.getByTestId('open-conflict').click();
  await expect(
    page.getByTestId('conflict-local').locator(`path[d="${localPaint}"]`)
  ).toBeVisible();
  await expect(
    page.getByTestId('conflict-remote').locator(`path[d="${remotePaint}"]`)
  ).toBeVisible();

  replies.push({ body: { revision: 8 }, status: 200 });
  await page.getByTestId('keep-mine').click();

  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-revision',
    '8'
  );

  const sent = uploads.at(-1);
  expect(sent?.baseRevision).toBe(7);
  expect(
    sent?.payload.shapes.some(
      (shape) => shape.kind === 'rectangle' && shape.x === 200
    )
  ).toBe(true);

  await page.reload();
  await expect(
    page.getByTestId('board').locator(`path[d="${localPaint}"]`)
  ).toBeVisible();
  await expect(
    page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
  ).toHaveCount(0);

  const stored = JSON.parse((await readStoredBoard(page, BOARD_ID)) ?? '{}');
  expect(stored.title).toBe('Linked');
  expect(
    stored.shapes.some(
      (shape: { kind?: string; x?: number }) =>
        shape.kind === 'rectangle' && shape.x === 200
    )
  ).toBe(true);
  expect(
    (await recordOf(page)).boards.find((board) => board.id === BOARD_ID)
  ).toMatchObject({ linked: true, revision: 8 });
  expect(await readStoredKey(page, conflictKey(BOARD_ID))).toBeNull();
});

test('take theirs writes the snapshot, offers the bytes, and paints the remote copy', async ({
  page,
}) => {
  await startConflict(page);
  await page.unroute('**/api/boards/*/sync');
  await page.route('**/api/boards/*/sync', answerAccepted(7));

  await page.getByTestId('open-conflict').click();
  await expect(
    page.getByTestId('conflict-remote').locator(`path[d="${remotePaint}"]`)
  ).toBeVisible();

  await page.getByTestId('take-theirs').click();
  await expect(
    page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
  ).toBeVisible();
  await expect(page.getByTestId('download-replaced')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-replaced').click(),
  ]);
  const path = await download.path();
  const replacedBytes = await readFile(path ?? '', 'utf8');
  const replaced = JSON.parse(replacedBytes) as {
    shapes: { id: string; kind?: string }[];
    title: string;
  };
  expect(replaced.title).toBe('Linked');
  expect(replaced.shapes.some((shape) => shape.kind === 'rectangle')).toBe(
    true
  );

  const snapshotBytes = await readStoredKey(page, snapshotKey(BOARD_ID));
  expect(replacedBytes).toBe(snapshotBytes);

  await page.reload();
  await expect(
    page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
  ).toBeVisible();

  const stored = JSON.parse((await readStoredBoard(page, BOARD_ID)) ?? '{}');
  expect(stored.title).toBe('Remote board');
  expect(stored.shapes).toEqual([remoteShape]);
  expect(
    (await recordOf(page)).boards.find((board) => board.id === BOARD_ID)
  ).toMatchObject({ linked: true, revision: 7 });
  expect(await readStoredKey(page, conflictKey(BOARD_ID))).toBeNull();
});

test('duplicate mine links a copy with the local bytes and takes the remote copy', async ({
  page,
}) => {
  await startConflict(page);
  await page.unroute('**/api/boards/*/sync');
  await page.route('**/api/boards/*/sync', async (route: Route) => {
    const body = route.request().postDataJSON() as Upload;
    uploads.push(body);
    await route.fulfill({
      json: { revision: body.baseRevision === null ? 1 : 7 },
    });
  });

  await page.getByTestId('open-conflict').click();
  await page.getByTestId('duplicate-mine').click();

  await expect(
    page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
  ).toBeVisible();

  await expect
    .poll(async () =>
      (await recordOf(page)).boards.find(
        (board) => board.title === 'Linked copy'
      )
    )
    .toMatchObject({ linked: true, revision: 1 });

  const copy = (await recordOf(page)).boards.find(
    (board) => board.title === 'Linked copy'
  );
  if (copy === undefined) {
    throw new Error('the duplicate is not in the library');
  }
  expect(copy.id).not.toBe(BOARD_ID);

  const sent = uploads.find((upload) => upload.payload.id === copy.id);
  expect(sent?.baseRevision).toBeNull();

  const copyBytes = JSON.parse((await readStoredBoard(page, copy.id)) ?? '{}');
  expect(
    copyBytes.shapes.some(
      (shape: { kind?: string; x?: number }) =>
        shape.kind === 'rectangle' && shape.x === 200
    )
  ).toBe(true);

  const original = JSON.parse((await readStoredBoard(page, BOARD_ID)) ?? '{}');
  expect(original.shapes).toEqual([remoteShape]);

  await page.goto(`/b/${copy.id}`);
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(
    page.getByTestId('board').locator(`path[d="${localPaint}"]`)
  ).toBeVisible();

  await page.goto(`/b/${BOARD_ID}`);
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(
    page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
  ).toBeVisible();
});

test('reopening without a cached copy fetches it once, then reuses the cache', async ({
  page,
}) => {
  await signIn(page);
  const downloads: string[] = [];

  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === `/api/boards/${BOARD_ID}`) {
      downloads.push(path);
    }
  });
  await page.route(`**/api/boards/${BOARD_ID}`, answerRemoteCopy);

  await openBoard(
    page,
    {
      id: BOARD_ID,
      sync: { conflict: 7, linked: true, revision: 2 },
      title: 'Linked',
    },
    { open: `/b/${BOARD_ID}?conflict=1`, waitFor: 'none' }
  );

  await expect(page.getByTestId('conflict-dialog')).toBeVisible();
  await expect(
    page.getByTestId('conflict-remote').locator(`path[d="${remotePaint}"]`)
  ).toBeVisible();
  expect(downloads).toEqual([`/api/boards/${BOARD_ID}`]);

  await page.getByTestId('close-conflict').click();
  await page.getByTestId('open-conflict').click();
  await expect(page.getByTestId('conflict-dialog')).toBeVisible();
  await expect(
    page.getByTestId('conflict-remote').locator(`path[d="${remotePaint}"]`)
  ).toBeVisible();

  expect(downloads).toEqual([`/api/boards/${BOARD_ID}`]);
});
