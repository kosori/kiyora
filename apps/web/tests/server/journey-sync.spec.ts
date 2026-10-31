import type { Page } from '@playwright/test';
import { E2E_BASE_URL } from '../e2e-server';
import { readStoredBoard } from '../fixtures/library';
import { expect, test } from '../fixtures/offline';
import { resetAccounts } from './reset';

const NAME = 'journey-sync';
const EMAIL = `${NAME}@kiyora.test`;
const PASSWORD = 'correct-horse-battery';

const FILL = 'rgba(25, 113, 194, 0.2)';

const FIRST = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';
const SECOND = 'M 450 150 L 600 150 L 600 250 L 450 250 Z';
const MINE = 'M 200 350 L 400 350 L 400 500 L 200 500 Z';
const OFFLINE = 'M 650 350 L 800 350 L 800 450 L 650 450 Z';
const STALE = 'M 450 350 L 600 350 L 600 450 L 450 450 Z';
const INTRUDER = 'M 500 400 L 650 400 L 650 500 L 500 500 Z';

type Rectangle = {
  h: number;
  w: number;
  x: number;
  y: number;
};

const painted = (page: Page, path: string) =>
  page.getByTestId('board').locator(`path[d="${path}"]`);

const syncStatus = (page: Page) => page.getByTestId('sync-status');

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const draw = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<void> => {
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 });
  await page.mouse.up();
};

const openCanvas = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
};

const saved = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
};

const signIn = async (page: Page, create: boolean): Promise<void> => {
  await page.goto('/sign-in');
  await page.getByTestId('dev-email').fill(EMAIL);
  await page.getByTestId('dev-password').fill(PASSWORD);
  await page.getByTestId(create ? 'dev-sign-up' : 'dev-sign-in').click();
  await expect(page.getByTestId('account-name')).toHaveText(NAME, {
    timeout: 30_000,
  });
};

/**
 * Restores the API route and wakes the retry listener the browser fires when
 * connectivity returns, so the pending upload leaves without a wait.
 */
const reconnect = async (page: Page): Promise<void> => {
  await page.unroute('**/api/boards/*/sync');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
  });
};

test.describe('the sync acceptance journey', () => {
  test.use({ offlineMode: 'none' });
  test.setTimeout(120_000);

  test.beforeEach(async () => {
    await resetAccounts();
  });

  test('signs in, links, syncs two browsers, resolves a conflict, shares, revokes and reconnects', async ({
    browser,
    page,
  }) => {
    const secondContext = await browser.newContext({ baseURL: E2E_BASE_URL });
    const viewerContext = await browser.newContext({ baseURL: E2E_BASE_URL });

    try {
      await signIn(page, true);

      await page.getByTestId('new-board').click();
      await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/, {
        timeout: 30_000,
      });
      const id = new URL(page.url()).pathname.split('/').at(-1) ?? '';
      await openCanvas(page);

      await draw(page, { x: 200, y: 150 }, { x: 400, y: 300 });
      await expect(painted(page, FIRST)).toHaveAttribute('fill', FILL);
      await saved(page);

      await page.getByTestId('link-board').click();
      await expect(syncStatus(page)).toHaveAttribute('data-state', 'synced');
      await expect(syncStatus(page)).toHaveAttribute('data-revision', '1');

      const second = await secondContext.newPage();
      await signIn(second, false);
      await second.goto('/');
      await expect(second.getByTestId('remote-boards')).toHaveAttribute(
        'data-state',
        'ready',
        { timeout: 30_000 }
      );

      const row = second.locator(
        `[data-testid="remote-board"][data-board-id="${id}"]`
      );
      await expect(row).toBeVisible();
      await expect(row.locator(`path[d="${FIRST}"]`)).toHaveAttribute(
        'fill',
        FILL
      );
      await row.click();
      await expect(second).toHaveURL(new RegExp(`/b/${id}$`));
      await openCanvas(second);
      await expect(painted(second, FIRST)).toHaveAttribute('fill', FILL);

      await draw(second, { x: 450, y: 150 }, { x: 600, y: 250 });
      await expect(painted(second, SECOND)).toHaveAttribute('fill', FILL);
      await saved(second);
      await expect(syncStatus(second)).toHaveAttribute('data-state', 'synced');
      await expect(syncStatus(second)).toHaveAttribute('data-revision', '2');

      await draw(page, { x: 200, y: 350 }, { x: 400, y: 500 });
      await expect(painted(page, MINE)).toHaveAttribute('fill', FILL);
      await expect(syncStatus(page)).toHaveAttribute('data-state', 'conflict', {
        timeout: 30_000,
      });
      await expect(syncStatus(page)).toHaveAttribute('data-remote', '2');

      await page.getByTestId('open-conflict').click();
      await expect(page.getByTestId('conflict-dialog')).toBeVisible();
      await expect(
        page.getByTestId('conflict-local').locator(`path[d="${MINE}"]`)
      ).toBeVisible();
      await expect(
        page.getByTestId('conflict-remote').locator(`path[d="${SECOND}"]`)
      ).toBeVisible();

      await page.getByTestId('keep-mine').click();
      await expect(syncStatus(page)).toHaveAttribute('data-state', 'synced');
      await expect(syncStatus(page)).toHaveAttribute('data-revision', '3');

      await page.reload();
      await openCanvas(page);
      await expect(painted(page, FIRST)).toHaveAttribute('fill', FILL);
      await expect(painted(page, MINE)).toHaveAttribute('fill', FILL);
      await expect(painted(page, SECOND)).toHaveCount(0);

      await page.getByTestId('share-board').click();
      await expect(page.getByTestId('share-dialog')).toBeVisible();
      await page.getByTestId('create-share-link').click();
      const shareUrl = await page.getByTestId('share-url').inputValue();
      expect(shareUrl).toContain('/s/');
      await page.getByTestId('close-share').click();

      const viewer = await viewerContext.newPage();
      await viewer.goto(shareUrl);
      await expect(viewer.getByTestId('share-board')).toBeVisible();
      await expect(
        viewer.getByTestId('share-board').locator(`path[d="${FIRST}"]`)
      ).toHaveAttribute('fill', FILL);
      await expect(
        viewer.getByTestId('share-board').locator(`path[d="${MINE}"]`)
      ).toHaveAttribute('fill', FILL);
      await expect(viewer.getByTestId('tool-rail')).toHaveCount(0);
      await expect(viewer.getByTestId('save-status')).toHaveCount(0);
      await expect(viewer.getByTestId('sync-status')).toHaveCount(0);
      await expect(viewer.getByTestId('board-title')).toHaveCount(0);

      const shareBox = await viewer.getByTestId('share-board').boundingBox();
      if (shareBox === null) {
        throw new Error('the shared board has no box');
      }
      await viewer.keyboard.press('r');
      await viewer.mouse.move(shareBox.x + 500, shareBox.y + 400);
      await viewer.mouse.down();
      await viewer.mouse.move(shareBox.x + 650, shareBox.y + 500);
      await viewer.mouse.up();
      await viewer.reload();
      await expect(viewer.getByTestId('share-board')).toBeVisible();
      await expect(
        viewer.getByTestId('share-board').locator(`path[d="${FIRST}"]`)
      ).toBeVisible();
      await expect(
        viewer.getByTestId('share-board').locator(`path[d="${INTRUDER}"]`)
      ).toHaveCount(0);

      await page.getByTestId('share-board').click();
      await expect(page.getByTestId('share-dialog')).toBeVisible();
      await page.getByTestId('revoke-share-link').click();
      await expect(page.getByTestId('create-share-link')).toBeVisible();
      await page.getByTestId('close-share').click();

      await viewer.reload();
      await expect(viewer.getByTestId('share-unavailable')).toBeVisible();

      await page.route('**/api/boards/*/sync', (route) => route.abort());
      await draw(page, { x: 650, y: 350 }, { x: 800, y: 450 });
      await expect(painted(page, OFFLINE)).toHaveAttribute('fill', FILL);
      await saved(page);
      await expect(syncStatus(page)).toHaveAttribute('data-state', 'error');
      await expect(syncStatus(page)).toHaveAttribute('data-reason', 'network');

      const uploaded = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/boards/${id}/sync` &&
          response.request().method() === 'POST' &&
          response.status() === 200
      );
      await reconnect(page);
      await uploaded;
      await expect(syncStatus(page)).toHaveAttribute('data-state', 'synced');
      await expect(syncStatus(page)).toHaveAttribute('data-revision', '4');

      const stored = JSON.parse((await readStoredBoard(page, id)) ?? '{}') as {
        shapes?: Rectangle[];
      };
      expect(stored.shapes).toContainEqual(
        expect.objectContaining({ h: 100, w: 150, x: 650, y: 350 })
      );

      await draw(second, { x: 450, y: 350 }, { x: 600, y: 450 });
      await expect(painted(second, STALE)).toHaveAttribute('fill', FILL);
      await expect(syncStatus(second)).toHaveAttribute(
        'data-state',
        'conflict',
        {
          timeout: 30_000,
        }
      );
      await expect(syncStatus(second)).toHaveAttribute('data-remote', '4');

      await second.getByTestId('open-conflict').click();
      await expect(
        second.getByTestId('conflict-remote').locator(`path[d="${OFFLINE}"]`)
      ).toBeVisible();
      await second.getByTestId('take-theirs').click();
      await expect(painted(second, OFFLINE)).toHaveAttribute('fill', FILL);
      await expect(painted(second, MINE)).toHaveAttribute('fill', FILL);
      await expect(painted(second, STALE)).toHaveCount(0);
      await expect(syncStatus(second)).toHaveAttribute('data-state', 'synced');
      await expect(syncStatus(second)).toHaveAttribute('data-revision', '4');
    } finally {
      await viewerContext.close();
      await secondContext.close();
    }
  });
});
