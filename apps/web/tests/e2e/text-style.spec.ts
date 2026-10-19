import { expect, type Page, test } from '@playwright/test';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

/** The canvas's place on the screen, so board coordinates can be exact. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

const labels = (page: Page) => board(page).locator('text').first();

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
};

/**
 * Place a text shape at `at`, type `words` into the overlay, and select the
 * shape again so the inspector is showing its controls.
 */
const labelledText = async (
  page: Page,
  at: { x: number; y: number },
  words: string
) => {
  await page.getByRole('button', { name: 'Text' }).click();
  await page.mouse.click(at.x, at.y);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill(words);
  await editor.blur();
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId('inspector-empty')).toHaveCount(0);
};

test('the inspector sizes a selected text shape, and the canvas paints the new size', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await labelledText(page, { x: box.x + 300, y: box.y + 200 }, 'Heading');

  const line = labels(page);
  await expect(line).toHaveAttribute('font-size', '16');

  await page.getByTestId('text-size-xlarge').click();

  await expect(line).toHaveAttribute('font-size', '32');
});

test('a text shape aligns left, centre or right, with no vertical control', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await labelledText(page, { x: box.x + 300, y: box.y + 200 }, 'Heading');

  await expect(page.getByTestId('text-size-small')).toBeVisible();
  await expect(page.getByTestId('text-align-center')).toBeVisible();
  await expect(page.getByTestId('text-align-left')).toBeVisible();
  await expect(page.getByTestId('text-align-right')).toBeVisible();
  await expect(page.getByTestId('text-valign-top')).toHaveCount(0);

  const line = labels(page);
  await page.getByTestId('text-align-left').click();
  await expect(line).toHaveAttribute('text-anchor', 'start');

  await page.getByTestId('text-align-right').click();
  await expect(line).toHaveAttribute('text-anchor', 'end');
});

test('a shape label also aligns vertically, moving its words down the shape', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.getByRole('button', { name: 'Rectangle' }).click();
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 400, y: box.y + 300 }
  );

  await page.mouse.dblclick(box.x + 300, box.y + 225);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Plan');
  await editor.blur();

  await page.mouse.click(box.x + 300, box.y + 225);

  await expect(page.getByTestId('text-valign-bottom')).toBeVisible();
  await expect(page.getByTestId('text-valign-top')).toBeVisible();

  const line = labels(page);
  const before = Number(await line.getAttribute('y'));

  await page.getByTestId('text-valign-bottom').click();

  await expect
    .poll(async () => Number(await line.getAttribute('y')))
    .toBeGreaterThan(before);
});

test('a text size change is one undo', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await labelledText(page, { x: box.x + 300, y: box.y + 200 }, 'Heading');

  const line = labels(page);
  await expect(line).toHaveAttribute('font-size', '16');

  await page.getByTestId('text-size-xlarge').click();
  await expect(line).toHaveAttribute('font-size', '32');

  await page.getByTestId('undo').click();
  await expect(line).toHaveAttribute('font-size', '16');
});

test('the editing overlay agrees with the canvas about the size and the alignment', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await labelledText(page, { x: box.x + 300, y: box.y + 200 }, 'Heading');

  await page.getByTestId('text-size-xlarge').click();
  await page.getByTestId('text-align-right').click();
  await expect(labels(page)).toHaveAttribute('font-size', '32');
  await expect(labels(page)).toHaveAttribute('text-anchor', 'end');

  await page.mouse.dblclick(box.x + 300, box.y + 200);

  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS('font-size', '32px');
  await expect(editor).toHaveCSS('text-align', 'right');
});
