import {
  openExistingBoard,
  readStoredBoard,
  type SeededBoard,
  seedBoards,
} from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * Presence is a board's, not the browser's. Two tabs on two boards are each the
 * writer of their own board; two tabs on one board still warn, and the later
 * one writes nothing. Every assertion is paint or stored bytes.
 */

const FIRST = 'board-first';
const SECOND = 'board-second';

const emptyBoard = (id: string): SeededBoard => ({ id, title: id });

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const drawRectangle = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<void> => {
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y);
  await page.mouse.up();
};

type StoredShape = {
  h: number;
  kind: string;
  w: number;
  x: number;
  y: number;
};

const storedShapes = async (page: Page, id: string): Promise<StoredShape[]> => {
  const bytes = await readStoredBoard(page, id);
  return bytes === null
    ? []
    : (JSON.parse(bytes) as { shapes: StoredShape[] }).shapes;
};

const geometry = (shapes: StoredShape[]) =>
  shapes.map(({ h, kind, w, x, y }) => ({ h, kind, w, x, y }));

const painted = (page: Page, d: string) =>
  page.getByTestId('board').locator(`path[d="${d}"]`);

const FIRST_PATH = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';
const SECOND_PATH = 'M 500 350 L 650 350 L 650 450 L 500 450 Z';

const primary = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('save-status')).not.toHaveAttribute(
    'data-secondary',
    'true'
  );
};

test('two tabs on two boards each hold their own board and save their own shape', async ({
  context,
}) => {
  const first = await context.newPage();
  await seedBoards(first, [emptyBoard(FIRST), emptyBoard(SECOND)], {
    open: `/b/${FIRST}`,
  });
  const second = await context.newPage();
  await openExistingBoard(second, SECOND);

  await primary(first);
  await primary(second);

  await drawRectangle(first, { x: 200, y: 150 }, { x: 400, y: 300 });
  await drawRectangle(second, { x: 500, y: 350 }, { x: 650, y: 450 });

  await expect(painted(first, FIRST_PATH)).toBeVisible();
  await expect(painted(second, SECOND_PATH)).toBeVisible();

  await expect
    .poll(async () => geometry(await storedShapes(first, FIRST)))
    .toEqual([{ h: 150, kind: 'rectangle', w: 200, x: 200, y: 150 }]);
  await expect
    .poll(async () => geometry(await storedShapes(second, SECOND)))
    .toEqual([{ h: 100, kind: 'rectangle', w: 150, x: 500, y: 350 }]);
});

test('a second tab on one board warns, and its edit never reaches the stored board', async ({
  context,
}) => {
  const first = await context.newPage();
  await seedBoards(first, [emptyBoard(FIRST)], { open: `/b/${FIRST}` });
  const second = await context.newPage();
  await openExistingBoard(second, FIRST);

  await primary(first);
  await expect(second.getByTestId('save-status')).toHaveAttribute(
    'data-secondary',
    'true'
  );
  await expect(second.getByTestId('save-status')).toContainText(
    'Open in another tab'
  );

  await drawRectangle(first, { x: 200, y: 150 }, { x: 400, y: 300 });
  await expect
    .poll(async () => geometry(await storedShapes(first, FIRST)))
    .toEqual([{ h: 150, kind: 'rectangle', w: 200, x: 200, y: 150 }]);

  await drawRectangle(second, { x: 500, y: 350 }, { x: 650, y: 450 });
  await expect(second.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'unsaved'
  );
  await second.waitForTimeout(700);

  expect(geometry(await storedShapes(second, FIRST))).toEqual([
    { h: 150, kind: 'rectangle', w: 200, x: 200, y: 150 },
  ]);
});
