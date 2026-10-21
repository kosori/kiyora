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

/** The canvas's place on the screen, so board coordinates can be dragged to exactly. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

/** Every shape's clean path, so a move is read by the geometry it paints. */
const shapePaths = (page: Page) => board(page).locator('path[data-shape]');

const frame = (page: Page) => page.getByTestId('selection-frame');

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

/** A rectangle drawn from `(x, y)` to `(x + w, y + h)` on the board. */
const drawRectangle = async (
  page: Page,
  box: { x: number; y: number },
  rectangle: { h: number; w: number; x: number; y: number }
) => {
  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + rectangle.x, y: box.y + rectangle.y },
    {
      x: box.x + rectangle.x + rectangle.w,
      y: box.y + rectangle.y + rectangle.h,
    }
  );
};

const selectBoth = async (page: Page, box: { x: number; y: number }) => {
  await page.mouse.click(box.x + 150, box.y + 150);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + 550, box.y + 130);
  await page.keyboard.up('Shift');
};

test('grouping two shapes hugs both, and dragging either moves both as one undo', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await drawRectangle(page, box, { h: 100, w: 100, x: 500, y: 80 });
  await selectBoth(page, box);

  await page.keyboard.press('Control+g');

  await expect(frame(page)).toHaveAttribute('x', '80');
  await expect(frame(page)).toHaveAttribute('y', '80');
  await expect(frame(page)).toHaveAttribute('width', '520');
  await expect(frame(page)).toHaveAttribute('height', '140');

  await drag(
    page,
    { x: box.x + 150, y: box.y + 150 },
    { x: box.x + 190, y: box.y + 190 }
  );

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 120 120 L 340 120 L 340 260 L 120 260 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 540 120 L 640 120 L 640 220 L 540 220 Z'
  );

  await page.keyboard.press('Control+z');

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 80 80 L 300 80 L 300 220 L 80 220 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 500 80 L 600 80 L 600 180 L 500 180 Z'
  );
});

test('a group inside a group moves as one, and ungrouping moves nothing', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await drawRectangle(page, box, { h: 100, w: 100, x: 500, y: 80 });
  await drawRectangle(page, box, { h: 60, w: 80, x: 620, y: 400 });

  await selectBoth(page, box);
  await page.keyboard.press('Control+g');
  await expect(frame(page)).toHaveAttribute('width', '520');

  await page.mouse.click(box.x + 150, box.y + 150);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + 660, box.y + 430);
  await page.keyboard.up('Shift');
  await expect(frame(page)).toHaveAttribute('width', '620');
  await page.keyboard.press('Control+g');
  await expect(frame(page)).toHaveAttribute('width', '620');

  await page.keyboard.press('ArrowRight');

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 81 80 L 301 80 L 301 220 L 81 220 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 501 80 L 601 80 L 601 180 L 501 180 Z'
  );
  await expect(shapePaths(page).nth(2)).toHaveAttribute(
    'd',
    'M 621 400 L 701 400 L 701 460 L 621 460 Z'
  );

  await page.keyboard.press('Control+Shift+g');
  await page.keyboard.press('Control+Shift+g');

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 81 80 L 301 80 L 301 220 L 81 220 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 501 80 L 601 80 L 601 180 L 501 180 Z'
  );
  await expect(shapePaths(page).nth(2)).toHaveAttribute(
    'd',
    'M 621 400 L 701 400 L 701 460 L 621 460 Z'
  );
});

test('ungrouping leaves each member exactly where it was', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await drawRectangle(page, box, { h: 100, w: 100, x: 500, y: 80 });
  await selectBoth(page, box);
  await page.keyboard.press('Control+g');

  await drag(
    page,
    { x: box.x + 150, y: box.y + 150 },
    { x: box.x + 190, y: box.y + 190 }
  );

  await page.keyboard.press('Control+Shift+g');

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 120 120 L 340 120 L 340 260 L 120 260 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 540 120 L 640 120 L 640 220 L 540 220 Z'
  );
  await expect(frame(page)).toHaveAttribute('x', '120');
  await expect(frame(page)).toHaveAttribute('width', '520');
});

test('a connector bound to a member keeps painting and re-routes after grouping', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await drawRectangle(page, box, { h: 100, w: 100, x: 500, y: 80 });

  await page.keyboard.press('c');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 550, y: box.y + 130 }
  );

  const connector = board(page).locator('path[data-shape="connector-1"]');
  await expect(connector.first()).toHaveAttribute('d', 'M 300 130 L 500 150');

  await selectBoth(page, box);
  await page.keyboard.press('Control+g');
  await page.keyboard.press('Shift+ArrowRight');

  await expect(connector.nth(0)).toHaveAttribute('d', 'M 308 130 L 508 150');
  // A connector paints its line and the head at its arrow end, so both paths
  // are read: the head moved with the line instead of being counted.
  await expect(connector.nth(1)).toHaveAttribute(
    'd',
    'M 508 150 L 496 156 L 496 144 Z'
  );
});

test('the shortcut reference names both group commands', async ({ page }) => {
  await open(page);

  await page.keyboard.press('?');

  const rows = page
    .getByRole('dialog', { name: 'Keyboard shortcuts' })
    .locator('li');

  await expect(rows.filter({ hasText: /^Group/ })).toContainText('CTRL + G');
  await expect(rows.filter({ hasText: /^Ungroup/ })).toContainText(
    'CTRL + SHIFT + G'
  );
});
