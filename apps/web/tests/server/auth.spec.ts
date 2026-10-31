import type { Page } from '@playwright/test';
import { E2E_BASE_URL } from '../e2e-server';
import {
  openExistingBoard,
  openLibrary,
  readStoredBoard,
  type SeededBoard,
  seedBoards,
} from '../fixtures/library';
import { expect, test } from '../fixtures/offline';
import { resetAccounts } from './reset';

const EMAIL = 'dev@kiyora.test';
const PASSWORD = 'correct-horse-battery';
const NAME = 'Dev Account';

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const PATH = 'M 40 40 L 160 40 L 160 120 L 40 120 Z';

const board: SeededBoard = {
  id: '11111111-1111-4111-8111-111111111111',
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
      w: 120,
      x: 40,
      y: 40,
    },
  ],
  title: 'Kept through sign-out',
};

const api = (page: Page, path: string, data?: object) =>
  page.request.post(path, {
    data,
    headers: { origin: E2E_BASE_URL },
  });

const createAccount = async (page: Page): Promise<void> => {
  const created = await api(page, '/api/auth/sign-up/email', {
    email: EMAIL,
    name: NAME,
    password: PASSWORD,
  });

  expect(created.ok()).toBe(true);
  await page.request.post('/api/auth/sign-out', {
    data: {},
    headers: { origin: E2E_BASE_URL },
  });
};

test.beforeEach(async () => {
  await resetAccounts();
});

test.describe('signed in', () => {
  test('a dev-credentials account creates a session and reads it back', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    await expect(page.getByTestId('sign-in-google')).toBeVisible();
    await expect(page.getByTestId('sign-in-github')).toBeVisible();
    await expect(page.getByTestId('dev-sign-in')).toBeVisible();

    await createAccount(page);

    const signedIn = await api(page, '/api/auth/sign-in/email', {
      email: EMAIL,
      password: PASSWORD,
    });
    expect(signedIn.ok()).toBe(true);

    const account = await page.request.get('/api/account');
    expect(account.status()).toBe(200);
    await expect(account.json()).resolves.toEqual({
      account: { email: EMAIL, name: NAME },
    });

    await page.goto('/');
    await expect(page.getByTestId('account-name')).toHaveText(NAME);

    await page.reload();
    await expect(page.getByTestId('account-name')).toHaveText(NAME);

    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('sign-in')).toBeVisible();

    const refused = await page.request.get('/api/account');
    expect(refused.status()).toBe(401);
  });

  test('the sign-in form signs in and the session survives a reload', async ({
    page,
  }) => {
    await openLibrary(page);
    await createAccount(page);

    await page.getByTestId('sign-in').click();
    await page.getByTestId('dev-email').fill(EMAIL);
    await page.getByTestId('dev-password').fill(PASSWORD);
    await page.getByTestId('dev-sign-in').click();

    await expect(page.getByTestId('account-name')).toHaveText(NAME);

    await page.reload();
    await expect(page.getByTestId('account-name')).toHaveText(NAME);
  });

  test('signing out keeps every local board and its bytes', async ({
    page,
  }) => {
    await seedBoards(page, [board], { open: '/' });
    await createAccount(page);

    const before = await readStoredBoard(page, board.id);

    await page.getByTestId('sign-in').click();
    await page.getByTestId('dev-email').fill(EMAIL);
    await page.getByTestId('dev-password').fill(PASSWORD);
    await page.getByTestId('dev-sign-in').click();
    await expect(page.getByTestId('account-name')).toHaveText(NAME);

    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('sign-in')).toBeVisible();

    await expect(
      page.getByTestId('library-board').filter({ hasText: board.title })
    ).toBeVisible();
    expect(await readStoredBoard(page, board.id)).toBe(before);

    await openExistingBoard(page, board.id);
    await expect(
      page.getByTestId('board').locator(`path[d="${PATH}"]`)
    ).toBeVisible();
  });
});

test.describe('signed out', () => {
  test.use({ offlineMode: 'local-api' });

  test('the library and the editor make no request to the app own API', async ({
    page,
    blockedRequests,
  }) => {
    await openLibrary(page, [board]);

    await expect(page.getByTestId('sign-in')).toBeVisible();

    await openExistingBoard(page, board.id);
    await expect(page.getByTestId('canvas')).toHaveAttribute(
      'data-ready',
      'true'
    );

    const ownApi = blockedRequests.filter((url) =>
      new URL(url).pathname.startsWith('/api/')
    );

    expect(ownApi).toEqual([]);
  });
});
