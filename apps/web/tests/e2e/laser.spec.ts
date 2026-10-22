import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

/**
 * The laser is present-scoped display state: a circle beside the slide, never
 * the slide. The proof is that the mark paints where the pointer goes, that it
 * is gone when presenting ends, and that the board, its stored bytes and the
 * exported SVG are byte-for-byte what they were before the slide show.
 */

/** Wait for the surface to say it can act, so the chrome is painted before it is read. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

/** A slide on the deck, so presenting has something to play. */
const openDeck = async (page: Page): Promise<void> => {
  await open(page);
  await page.getByTestId('rail-tab-deck').click();
  await page.getByTestId('template-title').click();
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
};

/** The starter rectangle's clean geometry, so the board is read by what it paints. */
const starterGeometry = (page: Page) =>
  page
    .getByTestId('board')
    .locator('path[data-shape="starter-rectangle"]')
    .getAttribute('d');

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

/** The SVG a person would download, as bytes. */
const exportSvg = async (page: Page): Promise<string> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);

  return readFile(await download.path(), 'utf8');
};

/** The mark's horizontal place on the slide, as it paints. */
const markX = async (page: Page): Promise<number> => {
  const value = await page.getByTestId('present-laser').getAttribute('cx');

  if (value === null) {
    throw new Error('the laser is not painted');
  }

  return Number(value);
};

test('the laser follows the pointer while presenting and dies with the slide show', async ({
  page,
}) => {
  await openDeck(page);

  const geometry = await starterGeometry(page);
  const stored = await storedBoard(page);
  const exported = await exportSvg(page);
  expect(stored).not.toBeNull();

  await page.getByTestId('present-button').click();

  const overlay = page.getByTestId('present-overlay');
  await expect(overlay).toBeVisible();

  const slide = await page.getByTestId('present-slide').boundingBox();
  if (slide === null) {
    throw new Error('the slide has no box');
  }

  const laser = page.getByTestId('present-laser');
  await page.mouse.move(slide.x + 100, slide.y + 100);
  await page.mouse.down();

  await expect(laser).toBeVisible();
  const first = await markX(page);
  expect(Math.abs(first - 100)).toBeLessThan(3);

  await page.mouse.move(slide.x + 320, slide.y + 220, { steps: 6 });

  await expect
    .poll(async () => (await markX(page)) - first)
    .toBeGreaterThan(150);

  await page.mouse.up();
  await expect(laser).toBeHidden();

  await page.mouse.down();
  await expect(laser).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(overlay).toBeHidden();
  await expect(laser).toBeHidden();
  await page.waitForTimeout(800);

  expect(await starterGeometry(page)).toBe(geometry);
  expect(await storedBoard(page)).toBe(stored);
  expect(await exportSvg(page)).toBe(exported);
});
