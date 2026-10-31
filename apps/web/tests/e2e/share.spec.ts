import type { Page, Route } from '@playwright/test';
import { E2E_BASE_URL } from '../e2e-server';
import {
  openExistingBoard,
  readStoredBoard,
  seedBoards,
} from '../fixtures/library';
import { expect, test } from '../fixtures/offline';

const LINKED_ID = '77777777-7777-4777-8777-777777777777';
const LOCAL_ID = '88888888-8888-4888-8888-888888888888';

const tokenState = { created: 0, token: null as string | null };

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const drawRectangle = async (page: Page) => {
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.up();
};

/**
 * A share endpoint double: one live token at a time, and a create replaces it
 * exactly as the real route revokes before it inserts.
 */
const answerShare = async (route: Route): Promise<void> => {
  const method = route.request().method();
  const state = tokenState;

  if (method === 'DELETE') {
    state.token = null;
    await route.fulfill({ json: { token: null } });
    return;
  }
  if (method === 'POST') {
    state.created += 1;
    state.token = `token-${state.created}`;
    await route.fulfill({ json: { token: state.token } });
    return;
  }

  await route.fulfill({ json: { token: state.token } });
};

test.beforeEach(() => {
  tokenState.created = 0;
  tokenState.token = null;
});

test('a linked board shares, copies, regenerates and revokes; a local board does not', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/api/boards/*/share', answerShare);
  await seedBoards(
    page,
    [
      { id: LINKED_ID, sync: { linked: true, revision: 1 }, title: 'Linked' },
      { id: LOCAL_ID, title: 'Local' },
    ],
    { open: `/b/${LINKED_ID}` }
  );

  await page.getByTestId('share-board').click();
  await expect(page.getByTestId('share-dialog')).toBeVisible();
  await expect(page.getByTestId('create-share-link')).toBeVisible();

  await page.getByTestId('create-share-link').click();
  await expect(page.getByTestId('share-url')).toHaveValue(
    `${E2E_BASE_URL}/s/token-1`
  );

  await page.getByTestId('copy-share-link').click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(`${E2E_BASE_URL}/s/token-1`);

  await page.getByTestId('regenerate-share-link').click();
  await expect(page.getByTestId('share-url')).toHaveValue(
    `${E2E_BASE_URL}/s/token-2`
  );

  await page.getByTestId('revoke-share-link').click();
  await expect(page.getByTestId('create-share-link')).toBeVisible();
  await expect(page.getByTestId('share-url')).toHaveCount(0);

  await openExistingBoard(page, LOCAL_ID);
  await expect(page.getByTestId('share-board')).toHaveCount(0);
});

test('the share action never appears on a local-only board after an edit', async ({
  page,
}) => {
  await page.route('**/api/boards/*/share', answerShare);
  await seedBoards(page, [{ id: LOCAL_ID, title: 'Local' }], {
    open: `/b/${LOCAL_ID}`,
  });

  await drawRectangle(page);
  await expect(page.getByTestId('share-board')).toHaveCount(0);
  await expect(page.getByTestId('sync-status')).toBeVisible();
  expect(await readStoredBoard(page, LOCAL_ID)).not.toBeNull();
});
