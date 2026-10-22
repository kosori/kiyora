import { expect, type Page, test } from '@playwright/test';

/**
 * Zen mode is a view state: the chrome goes and the board stays. The proof is
 * the space the board measures and the paint it keeps, never the number of
 * nodes on screen, and the board's stored bytes stay where they were.
 */

/** Wait for the surface to say it can act, so the chrome is painted before it is read. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

/** The canvas's width on the screen, which is what the chrome takes away from it. */
const canvasWidth = async (page: Page): Promise<number> => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box.width;
};

/** The board bytes the browser has written, read straight from IndexedDB. */
const storedBoard = (page: Page) =>
  page.evaluate(
    async (): Promise<string | null> =>
      new Promise<string | null>((resolve, reject) => {
        const opening = indexedDB.open('kiyora', 1);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const database = opening.result;
          if (!database.objectStoreNames.contains('boards')) {
            resolve(null);
            return;
          }
          const request = database
            .transaction('boards', 'readonly')
            .objectStore('boards')
            .get('kiyora:board');
          request.onerror = () => reject(request.error);
          request.onsuccess = () =>
            resolve((request.result as string | undefined) ?? null);
        };
      })
  );

/** The starter rectangle's clean geometry, so the board can be read by what it paints. */
const starterGeometry = (page: Page) =>
  page
    .getByTestId('board')
    .locator('path[data-shape="starter-rectangle"]')
    .getAttribute('d');

/** The chrome that frames the board, in the order it is read. */
const chrome = (page: Page) => [
  page.getByTestId('rail'),
  page.getByTestId('save-status'),
  page.getByTestId('camera-controls'),
  page.getByTestId('undo'),
  page.getByTestId('export-svg'),
];

test('zen hides the chrome, keeps the board and the save as they were, and Escape restores it', async ({
  page,
}) => {
  await open(page);

  const box = await page.getByTestId('canvas').boundingBox();
  if (box === null) {
    throw new Error('the canvas has no box');
  }
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 520, box.y + 400, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  const width = await canvasWidth(page);
  const geometry = await starterGeometry(page);
  const stored = await storedBoard(page);
  const undoDisabled = await page.getByTestId('undo').isDisabled();
  expect(stored).not.toBeNull();

  await page.keyboard.press('Backslash');

  await expect
    .poll(async () => (await canvasWidth(page)) - width)
    .toBeGreaterThan(200);
  await Promise.all(
    chrome(page).map((surface) => expect(surface).toBeHidden())
  );

  expect(await starterGeometry(page)).toBe(geometry);
  await page.waitForTimeout(800);
  expect(await storedBoard(page)).toBe(stored);

  await page.keyboard.press('Escape');

  await expect
    .poll(async () => Math.abs((await canvasWidth(page)) - width))
    .toBeLessThan(1);
  await Promise.all(
    chrome(page).map((surface) => expect(surface).toBeVisible())
  );
  expect(await starterGeometry(page)).toBe(geometry);
  expect(await page.getByTestId('undo').isDisabled()).toBe(undoDisabled);

  await page.keyboard.press('Backslash');
  await expect
    .poll(async () => (await canvasWidth(page)) - width)
    .toBeGreaterThan(200);
  await page.keyboard.press('Backslash');
  await expect
    .poll(async () => Math.abs((await canvasWidth(page)) - width))
    .toBeLessThan(1);
});

test('the reference teaches the zen chord, read from the keymap', async ({
  page,
}) => {
  await open(page);

  await page.keyboard.press('?');

  const row = page
    .getByRole('dialog', { name: 'Keyboard shortcuts' })
    .locator('li')
    .filter({ hasText: 'Zen mode' });

  await expect(row).toContainText('\\');
});
