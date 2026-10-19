import { expect, type Page, test } from '@playwright/test';

/**
 * The board is server-rendered, so its paint is on screen before React is
 * listening. Every gesture test opens through this, which waits for the surface
 * to say it can act.
 */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

/** Every shape's clean path, so a copy is counted and read by its own geometry. */
const shapePaths = (page: Page) =>
  page.getByTestId('board').locator('path[data-shape]:not([data-wobble])');

const ORIGINAL = 'M 80 80 L 300 80 L 300 220 L 80 220 Z';
/** The original offset by the copy offset — clear of it, not on top of it. */
const COPIED = 'M 104 104 L 324 104 L 324 244 L 104 244 Z';

test('copy then paste drops a visible copy, and one undo takes it back', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await expect(shapePaths(page)).toHaveCount(1);

  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');

  await expect(shapePaths(page)).toHaveCount(2);
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', COPIED);
  await expect(page.getByTestId('undo')).toBeEnabled();

  await page.keyboard.press('Control+z');

  await expect(shapePaths(page)).toHaveCount(1);
  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', ORIGINAL);
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('duplicate copies the selection clear of the original in one gesture', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await page.keyboard.press('Control+d');

  await expect(shapePaths(page)).toHaveCount(2);
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', COPIED);

  await page.keyboard.press('Control+z');

  await expect(shapePaths(page)).toHaveCount(1);
});

test('cut takes the selection off the board, and a paste brings it back visible', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await page.keyboard.press('Control+x');

  await expect(shapePaths(page)).toHaveCount(0);

  await page.keyboard.press('Control+v');

  await expect(shapePaths(page)).toHaveCount(1);
  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', COPIED);
});
