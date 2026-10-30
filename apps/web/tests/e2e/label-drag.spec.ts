import { expect, type Page, test } from '../fixtures/offline';

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

const labels = (page: Page) => board(page).locator('text');

/** Every clean path, so a shape is read by the geometry it paints. */
const shapePaths = (page: Page) => board(page).locator('path[data-shape]');

const connectorPaths = (page: Page) =>
  board(page).locator('path[data-shape="connector-1"]');

/** The connector's clean line — first in ink order, before its ribbon and heads. */
const connectorLine = (page: Page) => connectorPaths(page).first();

/** Whatever text the browser has selected, which a real pointer drag would cancel. */
const selectedText = (page: Page) =>
  page.evaluate(() => window.getSelection()?.toString() ?? '');

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

/** Labelling the starter rectangle, so the next drag can start on its words. */
const labelStarter = async (
  page: Page,
  box: { x: number; y: number },
  text: string
) => {
  await page.mouse.dblclick(box.x + 190, box.y + 150);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill(text);
  await editor.blur();
};

/** The label's own words, in screen pixels: exactly where a pointer drag begins. */
const labelPoint = async (page: Page) => {
  const box = await labels(page).first().boundingBox();

  if (box === null) {
    throw new Error('the label has no box');
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('a drag that starts on a label places a connector, painted to its partner', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan the release');

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 500, y: box.y + 80 },
    { x: box.x + 600, y: box.y + 180 }
  );

  await page.keyboard.press('c');
  await drag(page, await labelPoint(page), { x: box.x + 550, y: box.y + 130 });

  await expect(connectorLine(page)).toHaveAttribute('d', 'M 300 130 L 500 150');
  await expect(connectorLine(page)).toHaveAttribute('fill', 'none');
  await expect(connectorLine(page)).toHaveAttribute('stroke', '#1e1e1e');
  expect(await selectedText(page)).toBe('');
});

test('a drag that starts on a label moves the shape it labels', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan the release');

  await drag(page, await labelPoint(page), { x: box.x + 286, y: box.y + 190 });

  await expect(shapePaths(page).first()).toHaveAttribute(
    'd',
    'M 176 120 L 396 120 L 396 260 L 176 260 Z'
  );
  expect(await selectedText(page)).toBe('');
});

test('a label is still editable by double-click on its own words', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan');

  await page.mouse.dblclick(box.x + 190, box.y + 150);

  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();

  await editor.fill('Kickoff');
  await editor.blur();

  await expect(labels(page).first()).toContainText('Kickoff');
});

test('dragging on empty canvas still draws a marquee, not a text selection', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await labelStarter(page, box, 'Plan the release');

  await drag(
    page,
    { x: box.x + 700, y: box.y + 500 },
    { x: box.x + 40, y: box.y + 40 }
  );

  const frame = page.getByTestId('selection-frame');
  await expect(frame).toHaveAttribute('x', '80');
  await expect(frame).toHaveAttribute('width', '220');
  expect(await selectedText(page)).toBe('');
});
