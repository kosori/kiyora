import type { Page, Route } from '@playwright/test';
import { E2E_BASE_URL } from '../e2e-server';
import { openBoard, readStoredKey } from '../fixtures/library';
import { expect, test } from '../fixtures/offline';
import { resetAccounts } from './reset';

const EMAIL = 'sync-offline@kiyora.test';
const PASSWORD = 'correct-horse-battery';
const NAME = 'Sync Offline';

const BOARD_ID = '66666666-6666-4666-8666-666666666666';

const drawnPaint = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';

type Upload = {
  baseRevision: number | null;
  payload: {
    id: string;
    shapes: { kind?: string; x?: number }[];
  };
};

const uploads: Upload[] = [];
let offline = false;

/** Answers a sync while online, or drops it the way a lost connection does. */
const answerSync = async (route: Route): Promise<void> => {
  if (offline) {
    await route.abort();
    return;
  }
  uploads.push(route.request().postDataJSON() as Upload);
  await route.fulfill({ json: { revision: uploads.length }, status: 200 });
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
      pending?: boolean;
      revision?: number;
    }[];
  };

test.beforeEach(async () => {
  await resetAccounts();
  uploads.length = 0;
  offline = false;
});

test.use({ offlineMode: 'none' });

test('a queued upload survives a reload and leaves on reconnect', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/api/boards/*/sync', answerSync);
  await openBoard(page, { id: BOARD_ID, title: 'Linked' });

  await page.getByTestId('link-board').click();
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'synced'
  );
  expect(uploads).toHaveLength(1);

  offline = true;
  await drawRectangle(page);
  await expect(
    page.getByTestId('board').locator(`path[d="${drawnPaint}"]`)
  ).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'error'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-reason',
    'network'
  );

  expect(uploads).toHaveLength(1);

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-state',
    'error'
  );
  await expect(page.getByTestId('sync-status')).toHaveAttribute(
    'data-reason',
    'network'
  );

  offline = false;
  const uploaded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/boards/${BOARD_ID}/sync` &&
      response.request().method() === 'POST' &&
      response.status() === 200
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
  });
  await uploaded;

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

  const entry = (await recordOf(page)).boards.find(
    (board) => board.id === BOARD_ID
  );
  expect(entry).toMatchObject({ linked: true, revision: 2 });
  expect(entry?.pending).not.toBe(true);
});
