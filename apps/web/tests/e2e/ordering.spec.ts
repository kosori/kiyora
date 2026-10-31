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

/** The canvas's place on the screen, so board coordinates can be drawn at exactly. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

/** Every shape's clean path, in paint order, so an order change is read by paint. */
const shapePaths = (page: Page) =>
  page.getByTestId('board').locator('path[data-shape]');

/** The starter board's rectangle: 80,80 at 220x140. */
const STARTER = 'M 80 80 L 300 80 L 300 220 L 80 220 Z';

/** A rectangle drawn over the starter's right-hand half: 150,120 at 220x140. */
const DRAWN = 'M 150 120 L 370 120 L 370 260 L 150 260 Z';

const drawOverlapping = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await page.mouse.move(box.x + 150, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 370, box.y + 260);
  await page.mouse.up();
};

test('a shape sent backward paints behind, and one undo puts it back on top', async ({
  page,
}) => {
  await open(page);
  await drawOverlapping(page);

  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', DRAWN);

  const box = await canvasBox(page);
  await page.mouse.click(box.x + 340, box.y + 240);
  await page.keyboard.press('Control+[');

  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', DRAWN);
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', STARTER);

  await page.keyboard.press('Control+z');

  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', STARTER);
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', DRAWN);
});

test('the order is the document, so a reload paints it again', async ({
  page,
}) => {
  await open(page);
  await drawOverlapping(page);

  const box = await canvasBox(page);
  await page.mouse.click(box.x + 100, box.y + 100);
  await page.keyboard.press('Control+Shift+]');

  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', DRAWN);
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', STARTER);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', DRAWN);
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', STARTER);
});
