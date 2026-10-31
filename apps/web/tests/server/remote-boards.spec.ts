import { previewBoard } from '@kiyora/model';
import type { Page, Route } from '@playwright/test';
import { E2E_BASE_URL } from '../e2e-server';
import {
  openLibrary,
  readStoredBoard,
  readStoredKey,
  type SeededBoard,
  seededBoard,
} from '../fixtures/library';
import { expect, test } from '../fixtures/offline';
import { resetAccounts } from './reset';

const EMAIL = 'remote@kiyora.test';
const PASSWORD = 'correct-horse-battery';
const NAME = 'Remote Account';

const REMOTE_ID = '88888888-8888-4888-8888-888888888888';
const LOCAL_ID = '99999999-9999-4999-8999-999999999999';

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

const remotePaint = 'M 40 40 L 160 40 L 160 120 L 40 120 Z';

const remoteSummary: SeededBoard = {
  id: REMOTE_ID,
  shapes: [remoteShape],
  title: 'Remote board',
  updatedAt: 1_700_000_000_900,
};

const remoteBoard = seededBoard(remoteSummary);

const remotePreview = previewBoard(remoteBoard, { theme: 'light' });

const localBoard: SeededBoard = {
  id: LOCAL_ID,
  title: 'Local only',
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

const boardRequests = (page: Page): string[] => {
  const seen: string[] = [];

  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/boards')) {
      seen.push(path);
    }
  });

  return seen;
};

const answerListing =
  (boards: unknown[]) =>
  async (route: Route): Promise<void> => {
    await route.fulfill({ json: { boards } });
  };

const answerDownload = async (route: Route): Promise<void> => {
  await route.fulfill({ json: { payload: remoteBoard, revision: 7 } });
};

const summary = {
  bytes: JSON.stringify(remoteBoard).length,
  id: REMOTE_ID,
  preview: remotePreview,
  revision: 7,
  title: remoteSummary.title,
  updatedAt: new Date(remoteSummary.updatedAt ?? 0).toISOString(),
};

const recordOf = async (page: Page) =>
  JSON.parse((await readStoredKey(page, 'kiyora:library')) ?? 'null') as {
    boards: { id: string; linked?: boolean; revision?: number }[];
  };

test.beforeEach(async () => {
  await resetAccounts();
});

test.use({ offlineMode: 'none' });

test.describe('signed in', () => {
  test('lists a remote board, then opening it paints and links it', async ({
    page,
  }) => {
    await signIn(page);
    const requests = boardRequests(page);
    await page.route('**/api/boards', answerListing([summary]));
    await page.route('**/api/boards/*', answerDownload);

    await openLibrary(page, [localBoard]);

    const section = page.getByTestId('remote-boards');
    await expect(section).toHaveAttribute('data-state', 'ready');

    const row = page.getByTestId('remote-board').filter({
      hasText: 'Remote board',
    });
    await expect(row).toBeVisible();
    await expect(row.locator(`path[d="${remotePaint}"]`)).toBeVisible();
    expect(requests.filter((path) => path !== '/api/boards')).toEqual([]);

    await row.click();

    await expect(page).toHaveURL(new RegExp(`/b/${REMOTE_ID}$`));
    await expect(page.getByTestId('canvas')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 30_000 }
    );
    await expect(
      page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
    ).toBeVisible();

    expect(
      requests.filter((path) => path === `/api/boards/${REMOTE_ID}`)
    ).toHaveLength(1);

    const stored = JSON.parse((await readStoredBoard(page, REMOTE_ID)) ?? '{}');
    expect(stored.title).toBe('Remote board');
    expect(stored.shapes).toEqual([remoteShape]);

    expect(
      (await recordOf(page)).boards.find((board) => board.id === REMOTE_ID)
    ).toMatchObject({ linked: true, revision: 7 });
  });

  test('a board deleted remotely disappears on the next listing', async ({
    page,
  }) => {
    await signIn(page);
    let listed = [summary];
    await page.route('**/api/boards', (route) =>
      route.fulfill({ json: { boards: listed } })
    );

    await openLibrary(page, [localBoard]);
    const row = page.getByTestId('remote-board').filter({
      hasText: 'Remote board',
    });
    await expect(row).toBeVisible();

    listed = [];
    await page.goto('/');
    await expect(page.getByTestId('remote-boards')).toHaveAttribute(
      'data-state',
      'ready'
    );
    await expect(row).toBeHidden();
  });

  test('leaves a board this browser already holds out of the section', async ({
    page,
  }) => {
    await signIn(page);
    await page.route(
      '**/api/boards',
      answerListing([
        summary,
        {
          bytes: 1,
          id: LOCAL_ID,
          preview: null,
          revision: 1,
          title: localBoard.title,
          updatedAt: new Date(1_700_000_000_000).toISOString(),
        },
      ])
    );

    await openLibrary(page, [localBoard]);

    const section = page.getByTestId('remote-boards');
    await expect(section).toHaveAttribute('data-state', 'ready');
    await expect(
      section.getByTestId('remote-board').filter({ hasText: 'Remote board' })
    ).toBeVisible();
    await expect(section).not.toContainText('Local only');
  });

  test('signing out hides the section and keeps the downloaded board', async ({
    page,
  }) => {
    await signIn(page);
    const requests = boardRequests(page);
    await page.route('**/api/boards', answerListing([summary]));
    await page.route('**/api/boards/*', answerDownload);

    await openLibrary(page, [localBoard]);
    await expect(page.getByTestId('remote-boards')).toHaveAttribute(
      'data-state',
      'ready'
    );

    await page
      .getByTestId('remote-board')
      .filter({ hasText: 'Remote board' })
      .click();
    await expect(page.getByTestId('canvas')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 30_000 }
    );

    await page.goto('/');
    await expect(page.getByTestId('remote-boards')).toHaveAttribute(
      'data-state',
      'ready'
    );
    const settled = requests.length;

    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('sign-in')).toBeVisible();
    await expect(page.getByTestId('remote-boards')).toBeHidden();

    expect(requests.slice(settled)).not.toContain('/api/boards');

    const row = page.getByTestId('library-board').filter({
      hasText: 'Remote board',
    });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByTestId('canvas')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 30_000 }
    );
    await expect(
      page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
    ).toBeVisible();
  });
});

test('an API failure leaves the local library usable', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/boards', (route) => route.abort());

  await openLibrary(page, [localBoard]);

  await expect(page.getByTestId('remote-boards')).toHaveAttribute(
    'data-state',
    'unavailable'
  );
  await expect(page.getByTestId('remote-boards-unavailable')).toBeVisible();

  await page
    .getByTestId('library-board')
    .filter({ hasText: 'Local only' })
    .click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
});

test('signed out, the section is absent and no request is made', async ({
  page,
}) => {
  const requests = boardRequests(page);

  await openLibrary(page, [localBoard]);

  await expect(page.getByTestId('sign-in')).toBeVisible();
  await expect(page.getByTestId('remote-boards')).toHaveCount(0);
  expect(requests).toEqual([]);
});
