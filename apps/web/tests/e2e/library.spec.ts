import { LIBRARY_KEY } from '@kiyora/editor';
import {
  boardStorageKey,
  deleteStoredKey,
  openBoard,
  openExistingBoard,
  openLibrary,
  quarantineKey,
  readStoredBoard,
  readStoredKey,
  type SeededBoard,
  writeStoredKey,
} from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * The library: many boards, each at its own address, each saved on its own. The
 * proof is paint and bytes, never how many nodes a page holds.
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

const pathOf = (x: number): string =>
  `M ${x} 0 L ${x + 120} 0 L ${x + 120} 80 L ${x} 80 Z`;

const board = (
  id: string,
  title: string,
  updatedAt: number,
  shapeId: string,
  x: number
): SeededBoard => ({
  id,
  shapes: [rectangle(shapeId, x)],
  title,
  updatedAt,
});

const painted = (page: Page, x: number) =>
  page.getByTestId('board').locator(`path[d="${pathOf(x)}"]`);

const storedPayload = async (page: Page, id: string) => {
  const bytes = await readStoredBoard(page, id);
  return bytes === null ? null : JSON.parse(bytes);
};

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

test('two boards list newest first, each opens at its own address and keeps its own shapes', async ({
  page,
}) => {
  const older = board('board-older', 'Older', 2000, 'shape-older', 0);
  const newer = board('board-newer', 'Newer', 3000, 'shape-newer', 400);

  await openLibrary(page, [older, newer]);

  const rows = page.getByTestId('library-board');
  await expect(rows.nth(0)).toHaveAttribute('data-board-id', 'board-newer');
  await expect(rows.nth(0)).toContainText('Newer');
  await expect(rows.nth(1)).toHaveAttribute('data-board-id', 'board-older');
  await expect(rows.nth(0).locator('time')).toHaveAttribute(
    'datetime',
    new Date(3000).toISOString()
  );

  await rows.nth(0).click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(painted(page, 400)).toBeVisible();
  await expect(painted(page, 0)).toBeHidden();

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(painted(page, 400)).toBeVisible();

  await openExistingBoard(page, 'board-older');
  await expect(painted(page, 0)).toBeVisible();
  await expect(painted(page, 400)).toBeHidden();

  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  const storedNewer = await storedPayload(page, 'board-newer');
  expect(storedNewer.shapes.map((shape: { id: string }) => shape.id)).toEqual([
    'shape-newer',
  ]);
});

test('a new board starts empty at its own address and survives a reload', async ({
  page,
}) => {
  await openLibrary(page);
  await page.getByTestId('new-board').click();

  await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split('/').at(-1) ?? '';
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect
    .poll(async () => (await storedPayload(page, id))?.shapes)
    .toEqual([]);

  const first = await storedPayload(page, id);
  expect(first.id).toBe(id);
  expect(first.createdAt).toBeGreaterThan(0);
  expect(first.updatedAt).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  expect(new URL(page.url()).pathname).toBe(`/b/${id}`);

  await page.goto('/');
  await expect(page.getByTestId('library-board')).toContainText('Untitled');
});

test('a lost library record is rebuilt from the stored boards', async ({
  page,
}) => {
  const first = board('board-first', 'First', 1000, 'shape-first', 0);
  const second = board('board-second', 'Second', 2000, 'shape-second', 400);

  await openLibrary(page, [first, second]);

  await deleteStoredKey(page, LIBRARY_KEY);

  await page.reload();

  const rows = page.getByTestId('library-board');
  await expect(rows.nth(0)).toHaveAttribute('data-board-id', 'board-second');
  await expect(rows.nth(1)).toHaveAttribute('data-board-id', 'board-first');

  await rows.nth(0).click();
  await expect(painted(page, 400)).toBeVisible();
});

test('a corrupt board is reported alone, and the rest of the library still opens', async ({
  page,
}) => {
  const good = board('board-good', 'Good', 2000, 'shape-good', 0);
  const broken = board('board-broken', 'Broken', 3000, 'shape-broken', 400);

  await openLibrary(page, [good, broken]);

  await writeStoredKey(page, boardStorageKey('board-broken'), 'not a board');

  await openExistingBoard(page, 'board-broken');
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-fault',
    'corrupt'
  );
  await expect
    .poll(() => readStoredKey(page, quarantineKey('board-broken')))
    .toBe('not a board');

  await page.goto('/');
  await expect(page.getByTestId('library-board').nth(0)).toContainText(
    'Broken'
  );
  await expect(page.getByTestId('library-board').nth(1)).toContainText('Good');

  await page.getByTestId('library-board').nth(1).click();
  await expect(painted(page, 0)).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
});

test('an unheld address says the board is not found and offers the way back', async ({
  page,
}) => {
  await openBoard(page, board('board-only', 'Only', 1000, 'shape-only', 0), {
    open: '/b/board-that-never-existed',
    waitFor: 'none',
  });

  await expect(page.getByTestId('board-not-found')).toContainText(
    'Board not found'
  );
  await page.getByTestId('back-to-library').click();
  await expect(page.getByTestId('library-board')).toContainText('Only');
});

test('a save moves updatedAt forward, and undo never puts the old time back', async ({
  page,
}) => {
  await openBoard(page, board('board-clock', 'Clock', 1000, 'shape-clock', 0));

  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  const drawn = await storedPayload(page, 'board-clock');
  expect(drawn.updatedAt).toBeGreaterThan(1000);

  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  const undone = await storedPayload(page, 'board-clock');
  expect(undone.updatedAt).toBeGreaterThan(drawn.updatedAt);
  expect(undone.shapes.map((shape: { id: string }) => shape.id)).toEqual([
    'shape-clock',
  ]);
});

test('the memory fallback keeps a board between the library and its address', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });

  await page.goto('/');
  await page.getByTestId('new-board').click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.goBack();
  await expect(page.getByTestId('library-board')).toContainText('Untitled');
  await page.getByTestId('library-board').first().click();

  await expect(
    page
      .getByTestId('board')
      .locator('path[d="M 300 250 L 440 250 L 440 350 L 300 350 Z"]')
  ).toBeVisible();
});
