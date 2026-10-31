import { previewBoard } from '@kiyora/model';
import {
  boardStorageKey,
  openBoard,
  openLibrary,
  readStoredBoard,
  type SeededBoard,
  seededBoard,
} from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * Previews: each library tile is a picture of its board, derived from the
 * board's own paint, refreshed by the save that changes it, and still listed
 * when the payload cannot be opened. Every assertion reads a painted path.
 */

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const rectangle = (id: string, x: number) => ({
  h: 80,
  id,
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: STYLE,
  w: 120,
  x,
  y: 0,
});

type Shape = { h: number; w: number; x: number; y: number };

const pathOf = ({ h, w, x, y }: Shape): string =>
  `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;

/** The preview a seeded board's record would hold, derived from its own paint. */
const previewOf = (board: SeededBoard): string => {
  const svg = previewBoard(seededBoard(board), { theme: 'light' });
  if (svg === null) {
    throw new Error('the seeded board preview passed its cap');
  }
  return svg;
};

const board = (
  id: string,
  title: string,
  updatedAt: number,
  shapes: unknown[]
): SeededBoard => ({ id, shapes, title, updatedAt });

const rowOf = (page: Page, title: string) =>
  page.getByTestId('library-row').filter({ hasText: title });

const previewOfRow = (page: Page, title: string) =>
  rowOf(page, title).getByTestId('board-preview');

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();
  if (box === null) {
    throw new Error('the canvas has no box');
  }
  return box;
};

const drawRectangle = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 300, box.y + 250);
  await page.mouse.down();
  await page.mouse.move(box.x + 440, box.y + 350);
  await page.mouse.up();
};

test("a seeded board's tile paints the board's paths and opens at its address", async ({
  page,
}) => {
  const seeded = board('board-preview', 'Pictured', 2000, [
    rectangle('shape-preview', 0),
  ]);

  await openLibrary(page, [{ ...seeded, preview: previewOf(seeded) }]);

  await expect(
    previewOfRow(page, 'Pictured').locator(
      `path[d="${pathOf(rectangle('s', 0))}"]`
    )
  ).toBeVisible();

  await rowOf(page, 'Pictured').getByTestId('library-board').click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
  await expect(
    page.getByTestId('board').locator(`path[d="${pathOf(rectangle('s', 0))}"]`)
  ).toBeVisible();
});

test('drawing a shape refreshes the tile preview, and it survives a reload', async ({
  page,
}) => {
  const seeded = board('board-drawn', 'Drawn', 2000, [
    rectangle('shape-first', 0),
  ]);

  await openBoard(page, { ...seeded, preview: previewOf(seeded) });
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  const stored = JSON.parse(
    (await readStoredBoard(page, 'board-drawn')) ?? 'null'
  );
  const drawn = stored.shapes.find(
    (shape: { id: string }) => shape.id !== 'shape-first'
  );

  await page.goto('/');
  await expect(
    previewOfRow(page, 'Drawn').locator(
      `path[d="${pathOf(rectangle('s', 0))}"]`
    )
  ).toBeVisible();
  await expect(
    previewOfRow(page, 'Drawn').locator(`path[d="${pathOf(drawn)}"]`)
  ).toBeVisible();

  await page.reload();
  await expect(
    previewOfRow(page, 'Drawn').locator(`path[d="${pathOf(drawn)}"]`)
  ).toBeVisible();
});

test('a record with an unreadable payload still lists its title and preview, and opens', async ({
  page,
}) => {
  const seeded = board('board-corrupt', 'Corrupt', 2000, [
    rectangle('shape-corrupt', 0),
  ]);

  await openLibrary(page, [{ ...seeded, preview: previewOf(seeded) }], {
    raw: { [boardStorageKey('board-corrupt')]: 'not a board' },
  });

  await expect(rowOf(page, 'Corrupt')).toContainText('Corrupt');
  await expect(
    previewOfRow(page, 'Corrupt').locator(
      `path[d="${pathOf(rectangle('s', 0))}"]`
    )
  ).toBeVisible();

  await rowOf(page, 'Corrupt').getByTestId('library-board').click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
});

test('a board without a preview is a neutral tile that still opens', async ({
  page,
}) => {
  await openLibrary(page, [
    board('board-bare', 'Bare', 2000, [rectangle('shape-bare', 0)]),
  ]);

  await expect(previewOfRow(page, 'Bare')).toHaveAttribute(
    'data-empty',
    'true'
  );

  await rowOf(page, 'Bare').getByTestId('library-board').click();
  await expect(
    page.getByTestId('board').locator(`path[d="${pathOf(rectangle('s', 0))}"]`)
  ).toBeVisible();
});
