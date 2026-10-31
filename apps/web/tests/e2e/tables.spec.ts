import { readFile } from 'node:fs/promises';
import { openStarterBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * Tables at the browser seam: the grid paints inside the authored box, a cell's
 * words are edited in place, the edit is one undo, the table survives a reload,
 * and the export carries the same text positions the canvas painted.
 */

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
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

const board = (page: Page) => page.getByTestId('board');

const tablePaths = (page: Page) =>
  board(page).locator('path[data-shape="data-table-1"]');

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

/**
 * A table dragged from (300, 180) to (660, 360): 360 × 180, divided into three
 * columns of 120 and three rows of 60. The first cell's centre is (360, 210).
 */
const placeTable = async (page: Page, box: { x: number; y: number }) => {
  await page.getByRole('button', { name: 'Table' }).click();
  await drag(
    page,
    { x: box.x + 300, y: box.y + 180 },
    { x: box.x + 660, y: box.y + 360 }
  );
};

const editCell = async (
  page: Page,
  box: { x: number; y: number },
  words: string
) => {
  await page.mouse.dblclick(box.x + 360, box.y + 210);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill(words);
  await editor.blur();
};

/** Every path the table paints, as the geometry a person sees. */
const grid = (page: Page): Promise<(string | null)[]> =>
  tablePaths(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('d'))
  );

/** The painted words' own position, straight from the SVG. */
const textAt = (
  page: Page
): Promise<{ x: string | null; y: string | null }> => {
  const line = board(page).locator('text', { hasText: 'Plan' });

  return line.evaluate((node) => ({
    x: node.getAttribute('x'),
    y: node.getAttribute('y'),
  }));
};

test('a placed table paints its grid in the authored box', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);
  await placeTable(page, box);

  const painted = await grid(page);

  expect(painted).toContain('M 300 180 L 660 180 L 660 360 L 300 360 Z');
  expect(painted).toContain('M 420 180 L 420 360');
  expect(painted).toContain('M 540 180 L 540 360');
  expect(painted).toContain('M 300 240 L 660 240');
  expect(painted).toContain('M 300 300 L 660 300');
});

test('typing into a cell repaints its words where the overlay sat, and one undo takes them back', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await placeTable(page, box);
  await editCell(page, box, 'Plan');

  const line = board(page).locator('text', { hasText: 'Plan' });
  await expect(line).toHaveText('Plan');
  expect(await textAt(page)).toEqual({ x: '360', y: '212.4' });

  await page.getByTestId('undo').click();

  expect(await board(page).locator('text').allTextContents()).toEqual([]);
  await expect(tablePaths(page).first()).toHaveAttribute(
    'd',
    'M 300 180 L 660 180 L 660 360 L 300 360 Z'
  );
});

test('a table and its cell text survive a reload', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);
  await placeTable(page, box);
  await editCell(page, box, 'Plan');

  const before = await textAt(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect(board(page).locator('text', { hasText: 'Plan' })).toHaveText(
    'Plan'
  );
  expect(await textAt(page)).toEqual(before);
  expect(await grid(page)).toContain('M 420 180 L 420 360');
});

test('the exported SVG carries the cell words at the position the canvas painted', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await placeTable(page, box);
  await editCell(page, box, 'Plan');

  const at = await textAt(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await download.path(), 'utf8');

  expect(svg).toContain(`<text x="${at.x ?? ''}" y="${at.y ?? ''}"`);
  expect(svg).toContain('>Plan<');
});

test('the inspector adds a row and a column, and the painted grid moves with them', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await placeTable(page, box);
  await page.mouse.click(box.x + 320, box.y + 200);

  await expect(page.getByTestId('table-add-row')).toBeVisible();
  await page.getByTestId('table-add-row').click();

  expect(await grid(page)).toContain('M 300 225 L 660 225');

  await page.getByTestId('table-add-column').click();

  const painted = await grid(page);
  expect(painted).toContain('M 390 180 L 390 360');
  expect(painted).toContain('M 480 180 L 480 360');
  expect(painted).toContain('M 570 180 L 570 360');
  expect(painted).not.toContain('M 420 180 L 420 360');
});
