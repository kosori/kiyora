import { openStarterBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * The board is server-rendered, so its paint is on screen before React is
 * listening. Every gesture test opens through this, which waits for the surface
 * to say it can act.
 */
const open = async (page: Page): Promise<void> => {
  await openStarterBoard(page);
};

/** The canvas's place on the screen, so board coordinates can be exact. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
};

/** Every shape's clean path, so a copy is counted and read by its own geometry. */
const shapePaths = (page: Page) =>
  page.getByTestId('board').locator('path[data-shape]');

const ORIGINAL = 'M 80 80 L 300 80 L 300 220 L 80 220 Z';
/** The original offset by the copy offset — clear of it, not on top of it. */
const COPIED = 'M 104 104 L 324 104 L 324 244 L 104 244 Z';

test('copy then paste drops a visible copy, and one undo takes it back', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await expect(shapePaths(page).first()).toHaveAttribute('d', ORIGINAL);

  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');

  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', COPIED);
  await expect(page.getByTestId('undo')).toBeEnabled();

  await page.keyboard.press('Control+z');

  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', ORIGINAL);
  await expect(shapePaths(page).nth(1)).toBeHidden();
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('duplicate copies the selection clear of the original in one gesture', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await page.keyboard.press('Control+d');

  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', COPIED);

  await page.keyboard.press('Control+z');

  await expect(shapePaths(page).first()).toHaveAttribute('d', ORIGINAL);
  await expect(shapePaths(page).nth(1)).toBeHidden();
});

test('cut takes the selection off the board, and a paste brings it back visible', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await page.keyboard.press('Control+x');

  await expect(shapePaths(page).first()).toBeHidden();

  await page.keyboard.press('Control+v');

  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', COPIED);
});

test('a connector between two copied shapes is copied too, joined to the copies', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 500, y: box.y + 80 },
    { x: box.x + 600, y: box.y + 180 }
  );

  await page.keyboard.press('c');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 550, y: box.y + 130 }
  );

  await page.mouse.click(box.x + 150, box.y + 150);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + 550, box.y + 130);
  await page.keyboard.up('Shift');

  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');

  const copiedLine = page
    .getByTestId('board')
    .locator('path[data-shape="connector-2"]')
    .first();
  await expect(copiedLine).toHaveAttribute('d', 'M 324 154 L 524 174');

  const originalLine = page
    .getByTestId('board')
    .locator('path[data-shape="connector-1"]')
    .first();
  await expect(originalLine).toHaveAttribute('d', 'M 300 130 L 500 150');
});
