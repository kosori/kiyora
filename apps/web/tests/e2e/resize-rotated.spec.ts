import { expect, type Page, test } from '../fixtures/offline';

/**
 * A turned shape plus an upright one: the selection frame is axis-aligned, and
 * a one-way drag would have to skew the turned member to follow it.
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

/** The starter rectangle, then the rectangle drawn beside it. */
const shapes = (page: Page) => page.getByTestId('board').locator('path');

test('an edge drag refuses to skew a selected turned shape, and says why', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 400, y: box.y + 80 },
    { x: box.x + 500, y: box.y + 180 }
  );

  await page.mouse.click(box.x + 150, box.y + 150);
  await drag(
    page,
    { x: box.x + 190, y: box.y + 58 },
    { x: box.x + 290, y: box.y + 150 }
  );

  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + 450, box.y + 130);
  await page.keyboard.up('Shift');

  await page.mouse.move(box.x + 500, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 600, box.y + 150, { steps: 4 });

  const refusal = page.getByTestId('resize-refusal');
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText('Rotated shapes scale uniformly only');
  await expect(refusal).toContainText('skew');

  await expect(shapes(page).first()).toHaveAttribute(
    'd',
    'M 260 40 L 260 260 L 120 260 L 120 40 Z'
  );
  await expect(shapes(page).nth(1)).toHaveAttribute(
    'd',
    'M 400 80 L 500 80 L 500 180 L 400 180 Z'
  );

  await page.mouse.up();
});
