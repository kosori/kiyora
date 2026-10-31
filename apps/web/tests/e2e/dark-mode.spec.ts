import { readFile } from 'node:fs/promises';
import { openStarterBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * Dark mode is two settings, not one. These tests drive both at the browser
 * seam, where the proof is paint: a computed colour that changes, a canvas that
 * repaints, a PNG whose pixels carry the theme. The chrome's appearance is read
 * from the rail, and the board's theme from the canvas fill it names.
 */

const open = async (page: Page): Promise<void> => {
  await openStarterBoard(page);
};

/** The rail's painted background, which is the chrome's most visible colour. */
const chromeColour = (page: Page): Promise<string> =>
  page
    .getByTestId('rail')
    .evaluate((element) => getComputedStyle(element).backgroundColor);

const isDarkRoot = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.classList.contains('dark'));

const canvasFill = (page: Page) => page.getByTestId('canvas-fill');

const pick = async (
  page: Page,
  group: string,
  value: string
): Promise<void> => {
  await page.getByTestId(`${group}-${value}`).click();
};

/** Opens the PNG panel and takes a solid board export, as the bytes a person gets. */
const exportSolid = async (page: Page): Promise<Buffer> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-png').click(),
  ]);
  const path = await download.path();

  if (path === null) {
    throw new Error('the download has no path');
  }

  return readFile(path);
};

/** The RGBA at one point of a PNG, read through the browser's own decoder. */
const pixelAt = (page: Page, bytes: Buffer, point: { x: number; y: number }) =>
  page.evaluate(
    async ({ data, at }) => {
      const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');

      if (context === null) {
        throw new Error('the page offered no 2D context');
      }

      context.drawImage(bitmap, 0, 0);
      const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(
        at.x,
        at.y,
        1,
        1
      ).data;

      return [r, g, b, a];
    },
    { at: point, data: [...bytes] }
  );

test('appearance repaints the chrome, and the choice survives a reload', async ({
  page,
}) => {
  await open(page);
  expect(await isDarkRoot(page)).toBe(false);
  const light = await chromeColour(page);

  await pick(page, 'appearance', 'dark');

  await expect.poll(() => isDarkRoot(page)).toBe(true);
  const dark = await chromeColour(page);
  expect(dark).not.toBe(light);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('kiyora:appearance')))
    .toBe('dark');

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect.poll(() => isDarkRoot(page)).toBe(true);
  expect(await chromeColour(page)).toBe(dark);
});

test('appearance starts at the system and follows it until a person picks', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  await expect.poll(() => isDarkRoot(page)).toBe(true);
  const systemDark = await chromeColour(page);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => isDarkRoot(page)).toBe(false);
  const systemLight = await chromeColour(page);
  expect(systemLight).not.toBe(systemDark);

  await pick(page, 'appearance', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => isDarkRoot(page)).toBe(false);

  await pick(page, 'appearance', 'system');
  await expect.poll(() => isDarkRoot(page)).toBe(true);
  expect(await chromeColour(page)).toBe(systemDark);
});

/** The canvas's place on the screen, so a gesture lands at a known board point. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

/** Draws a second rectangle, so the board's own bounds leave background in an export. */
const drawRectangle = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 520, box.y + 380, { steps: 4 });
  await page.mouse.up();
};

test('the board theme repaints the canvas and the PNG, and one undo returns it', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await expect(canvasFill(page)).toHaveAttribute('fill', '#ffffff');

  await page.getByTestId('png-options').click();
  await pick(page, 'png-scale', '1');
  await pick(page, 'png-background', 'solid');

  const gap = { x: 270, y: 180 };

  expect(await pixelAt(page, await exportSolid(page), gap)).toEqual([
    255, 255, 255, 255,
  ]);

  await pick(page, 'board-theme', 'dark');
  await expect(canvasFill(page)).toHaveAttribute('fill', '#1e1e1e');
  expect(await pixelAt(page, await exportSolid(page), gap)).toEqual([
    30, 30, 30, 255,
  ]);

  await page.keyboard.press('Control+z');
  await expect(canvasFill(page)).toHaveAttribute('fill', '#ffffff');
  expect(await pixelAt(page, await exportSolid(page), gap)).toEqual([
    255, 255, 255, 255,
  ]);

  await pick(page, 'board-theme', 'dark');
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(canvasFill(page)).toHaveAttribute('fill', '#1e1e1e');
});

test('a dark board presents on its own canvas, not on the chrome', async ({
  page,
}) => {
  await open(page);
  await pick(page, 'board-theme', 'dark');

  await page.getByTestId('rail-tab-deck').click();
  await page.getByTestId('template-blank').click();
  await page.getByTestId('present-button').click();

  await expect(page.getByTestId('present-slide')).toBeVisible();
  await expect(page.getByTestId('present-surface')).toHaveCSS(
    'background-color',
    'rgb(30, 30, 30)'
  );

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('present-overlay')).toBeHidden();
});

test('a dark chrome keeps a light board, and the reverse holds', async ({
  page,
}) => {
  await open(page);

  await pick(page, 'appearance', 'dark');
  const darkChrome = await chromeColour(page);
  await expect(canvasFill(page)).toHaveAttribute('fill', '#ffffff');

  await pick(page, 'board-theme', 'dark');
  await expect(canvasFill(page)).toHaveAttribute('fill', '#1e1e1e');
  expect(await chromeColour(page)).toBe(darkChrome);

  await pick(page, 'appearance', 'light');
  await expect(canvasFill(page)).toHaveAttribute('fill', '#1e1e1e');
  expect(await chromeColour(page)).not.toBe(darkChrome);
});

test('neither setting makes a request', async ({ page }) => {
  await open(page);
  await pick(page, 'appearance', 'dark');
  await pick(page, 'board-theme', 'dark');
  await expect(canvasFill(page)).toHaveAttribute('fill', '#1e1e1e');
  await page.getByTestId('png-options').click();
  await pick(page, 'png-background', 'solid');
  await exportSolid(page);
});
