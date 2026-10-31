import { readFile } from 'node:fs/promises';
import { LIBRARY_KEY } from '@kiyora/editor';
import {
  boardFileBytes,
  openBoard,
  openLibrary,
  openStarterBoard,
  readStoredBoard,
  readStoredKey,
  type SeededBoard,
} from '../fixtures/library';
import { expect, type Locator, type Page, test } from '../fixtures/offline';

const drawn = {
  d: 'M 200 150 L 400 150 L 400 300 L 200 300 Z',
  fill: 'rgba(25, 113, 194, 0.2)',
  stroke: '#1e1e1e',
};

const drawnSecond = 'M 60 320 L 260 320 L 260 470 L 60 470 Z';

const importedPath = 'M 400 100 L 550 100 L 550 200 L 400 200 Z';

const heldPath = 'M 0 0 L 150 0 L 150 100 L 0 100 Z';

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const rectangleShape = (id: string, x: number, y: number) => ({
  h: 100,
  id,
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: STYLE,
  w: 150,
  x,
  y,
});

const importedBoard = (): SeededBoard => ({
  id: 'imported-board',
  shapes: [rectangleShape('imported-rectangle', 400, 100)],
  title: 'Imported',
});

const heldBoard = (): SeededBoard => ({
  id: 'imported-board',
  shapes: [rectangleShape('held-rectangle', 0, 0)],
  title: 'Held',
  updatedAt: 1_600_000_000_000,
});

const open = async (page: Page): Promise<void> => {
  await openStarterBoard(page);
};

const drawRectangle = async (
  page: Page,
  at: { x: number; y: number } = { x: 200, y: 150 }
): Promise<void> => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  await page.keyboard.press('r');
  await page.mouse.move(box.x + at.x, box.y + at.y);
  await page.mouse.down();
  await page.mouse.move(box.x + at.x + 200, box.y + at.y + 150);
  await page.mouse.up();
};

const paintAt = (page: Page, d: string): Locator =>
  page.getByTestId('board').locator(`path[d="${d}"]`);

const rectangle = (page: Page): Locator => paintAt(page, drawn.d);

const importedRectangle = (page: Page): Locator => paintAt(page, importedPath);

const heldRectangle = (page: Page): Locator => paintAt(page, heldPath);

const saveFile = async (page: Page): Promise<string> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-file').click(),
  ]);

  return readFile(await download.path(), 'utf8');
};

type Surface = 'board' | 'library';

const importFile = async (
  page: Page,
  surface: Surface,
  name: string,
  bytes: string
): Promise<void> => {
  const button = page.getByTestId(
    surface === 'board' ? 'import-file' : 'library-import-file'
  );
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    button.click(),
  ]);
  await chooser.setFiles({
    buffer: Buffer.from(bytes, 'utf8'),
    mimeType: 'application/json',
    name,
  });
};

const rowsNamed = (page: Page, title: string): Locator =>
  page.getByTestId('library-row').filter({ hasText: title });

const openRow = async (page: Page, row: Locator): Promise<void> => {
  await row.getByTestId('library-board').click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
};

/** A board as version 1 wrote it: no source on any frame, and no group kind. */
const legacy = {
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  id: 'legacy-board',
  schemaVersion: 1,
  settings: { theme: 'light' },
  shapes: [
    {
      h: 150,
      id: 'legacy-rectangle',
      kind: 'rectangle',
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: {
        corner: 'sharp',
        dash: 'solid',
        fill: 'blue',
        fillStyle: 'pastel',
        stroke: 'ink',
        strokeWidth: 2,
      },
      w: 200,
      x: 200,
      y: 150,
    },
  ],
  title: 'Legacy',
  updatedAt: 1_700_000_000_000,
};

test('importing a board file adds it to the library and leaves the open board painted', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await drawRectangle(page, { x: 60, y: 320 });
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await importFile(
    page,
    'board',
    'imported.kyr.json',
    boardFileBytes(importedBoard())
  );

  await expect(page.getByTestId('import-notice')).toContainText(
    'Imported “Imported” to the library'
  );
  await expect(rectangle(page)).toHaveAttribute('fill', drawn.fill);
  await expect(rectangle(page)).toHaveAttribute('stroke', drawn.stroke);
  await expect(paintAt(page, drawnSecond)).toBeVisible();
  await expect(importedRectangle(page)).toBeHidden();

  await page.goto('/');
  await expect(rowsNamed(page, 'Imported')).toHaveAttribute(
    'data-board-id',
    'imported-board'
  );

  await openRow(page, rowsNamed(page, 'Imported'));
  await expect(importedRectangle(page)).toHaveAttribute('fill', drawn.fill);
  await expect(importedRectangle(page)).toHaveAttribute('stroke', drawn.stroke);
  await expect(importedRectangle(page)).toHaveAttribute('stroke-width', '2');
  await expect(paintAt(page, drawnSecond)).toBeHidden();
  await expect(rectangle(page)).toBeHidden();
});

test('importing the same file twice makes two boards with different ids, and both open', async ({
  page,
}) => {
  await openLibrary(page);
  const bytes = boardFileBytes(importedBoard());

  await importFile(page, 'library', 'imported.kyr.json', bytes);
  const rows = rowsNamed(page, 'Imported');
  await expect(rows.nth(0)).toHaveAttribute('data-board-id', 'imported-board');

  await importFile(page, 'library', 'imported.kyr.json', bytes);
  await expect(rows.nth(1)).toBeVisible();
  const secondId = await rows.nth(1).getAttribute('data-board-id');
  expect(secondId).not.toBe('imported-board');
  expect(secondId).toMatch(/^[0-9a-f-]{36}$/);

  const second = await readStoredBoard(page, secondId ?? '');
  expect(JSON.parse(second ?? 'null').id).toBe(secondId);

  await openRow(page, rows.nth(0));
  await expect(importedRectangle(page)).toBeVisible();

  await page.goto('/');
  await openRow(page, rowsNamed(page, 'Imported').nth(1));
  await expect(importedRectangle(page)).toBeVisible();
});

test('a file whose id the library already holds imports under a new id, and both paint', async ({
  page,
}) => {
  await openBoard(page, heldBoard());
  await expect(heldRectangle(page)).toBeVisible();

  await importFile(
    page,
    'board',
    'imported.kyr.json',
    boardFileBytes(importedBoard())
  );

  await expect(heldRectangle(page)).toBeVisible();
  await expect(importedRectangle(page)).toBeHidden();

  await page.goto('/');
  await expect(rowsNamed(page, 'Held')).toHaveAttribute(
    'data-board-id',
    'imported-board'
  );
  const fresh = rowsNamed(page, 'Imported');
  await expect(fresh.nth(0)).toBeVisible();
  const freshId = await fresh.nth(0).getAttribute('data-board-id');
  expect(freshId).not.toBe('imported-board');

  await openRow(page, rowsNamed(page, 'Held'));
  await expect(heldRectangle(page)).toBeVisible();
  await expect(importedRectangle(page)).toBeHidden();

  await page.goto('/');
  await openRow(page, rowsNamed(page, 'Imported'));
  await expect(importedRectangle(page)).toBeVisible();
  await expect(heldRectangle(page)).toBeHidden();
});

test('an invalid or over-cap file says why and adds nothing', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
  const listBefore = await readStoredKey(page, LIBRARY_KEY);
  const boardBefore = await readStoredBoard(page, 'starter-board');

  await importFile(page, 'board', 'notes.txt', 'this is not a board');
  await expect(page.getByTestId('file-error')).toContainText(/JSON/);

  await importFile(page, 'board', 'board.kyr.json', '{"id":"board-1"}');
  await expect(page.getByTestId('file-error')).toContainText(/shapes/);

  await importFile(
    page,
    'board',
    'future.kyr.json',
    JSON.stringify({ ...legacy, schemaVersion: 4 })
  );
  await expect(page.getByTestId('file-error')).toContainText(/schemaVersion/);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('import-file').click(),
  ]);
  await chooser.setFiles({
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1, 'x'),
    mimeType: 'application/json',
    name: 'huge.kyr.json',
  });
  await expect(page.getByTestId('file-error')).toContainText(
    /8388608-byte cap/
  );

  await expect(rectangle(page)).toHaveAttribute('fill', drawn.fill);
  expect(await readStoredKey(page, LIBRARY_KEY)).toBe(listBefore);
  expect(await readStoredBoard(page, 'starter-board')).toBe(boardBefore);

  await page.goto('/');
  await importFile(page, 'library', 'notes.txt', 'this is not a board');
  await expect(page.getByTestId('import-error')).toContainText(/JSON/);
  expect(await readStoredKey(page, LIBRARY_KEY)).toBe(listBefore);
});

test('a board saved before this build imports and saves as the newest version', async ({
  page,
}) => {
  await open(page);

  await importFile(page, 'board', 'legacy.kyr.json', JSON.stringify(legacy));

  await page.goto('/');
  await expect(rowsNamed(page, 'Legacy')).toHaveAttribute(
    'data-board-id',
    'legacy-board'
  );

  await openRow(page, rowsNamed(page, 'Legacy'));
  await expect(rectangle(page)).toHaveAttribute('fill', drawn.fill);
  await expect(rectangle(page)).toHaveAttribute('stroke', drawn.stroke);

  const saved = JSON.parse(await saveFile(page)) as { schemaVersion: number };
  expect(saved.schemaVersion).toBe(3);
});

test('a saved file imports at its own id when that id is free, and saves back byte-for-byte', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
  const first = await saveFile(page);

  await page.goto('/');
  const starter = rowsNamed(page, 'Kiyora');
  await starter.getByTestId('delete-board').click();
  await page.getByTestId('delete-dialog').getByTestId('confirm-delete').click();
  await expect(page.getByTestId('library')).toContainText('No boards yet');

  await importFile(page, 'library', 'board.kyr.json', first);
  await expect(rowsNamed(page, 'Kiyora')).toHaveAttribute(
    'data-board-id',
    'starter-board'
  );

  await openRow(page, rowsNamed(page, 'Kiyora'));
  await expect(rectangle(page)).toHaveAttribute('fill', drawn.fill);

  expect(await saveFile(page)).toBe(first);
});
