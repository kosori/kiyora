import { LIBRARY_KEY } from '@kiyora/editor';
import {
  boardStorageKey,
  openLibrary,
  quarantineKey,
  readStoredBoard,
  readStoredKey,
  type SeededBoard,
} from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * Rename, duplicate and delete from the library and from the editor. Every
 * assertion is paint or stored bytes: a row that merely exists proves nothing.
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

const rowOf = (page: Page, title: string) =>
  page.getByTestId('library-row').filter({ hasText: title });

/**
 * Opens a board already in the library. The first visit to the board route pays
 * the dev server's compile, which outlasts the suite's default assertion wait.
 */
const openRow = async (page: Page, title: string): Promise<void> => {
  await rowOf(page, title).getByTestId('library-board').click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
};

/** Opens a board by its address, allowing for the dev server's first compile. */
const openAt = async (page: Page, id: string): Promise<void> => {
  await page.goto(`/b/${id}`);
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
};

const storedPayload = async (page: Page, id: string) => {
  const bytes = await readStoredBoard(page, id);
  return bytes === null ? null : JSON.parse(bytes);
};

const record = async (page: Page) => {
  const bytes = await readStoredKey(page, LIBRARY_KEY);
  return bytes === null
    ? null
    : (JSON.parse(bytes) as {
        boards: { id: string; title: string; updatedAt: number }[];
      });
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

test('a rename in the list and a rename in the editor leave one name after a reload', async ({
  page,
}) => {
  await openLibrary(page, [board('board-named', 'Named', 1000, 'shape', 0)]);

  const row = rowOf(page, 'Named');
  await row.getByTestId('rename-board').click();
  const input = page.getByTestId('rename-input');
  await input.fill('Plan');
  await input.press('Enter');

  await expect(rowOf(page, 'Plan')).toBeVisible();
  await expect
    .poll(async () => (await storedPayload(page, 'board-named'))?.title)
    .toBe('Plan');
  await expect
    .poll(
      async () =>
        (await record(page))?.boards.find(({ id }) => id === 'board-named')
          ?.title
    )
    .toBe('Plan');

  await openRow(page, 'Plan');
  const title = page.getByTestId('board-title');
  await expect(title).toHaveValue('Plan');

  await title.fill('Roadmap');
  await title.press('Enter');
  await expect
    .poll(async () => (await storedPayload(page, 'board-named'))?.title)
    .toBe('Roadmap');

  await page.goto('/');
  await expect(rowOf(page, 'Roadmap')).toBeVisible();
  await page.reload();
  await expect(rowOf(page, 'Roadmap')).toBeVisible();

  await openRow(page, 'Roadmap');
  await expect(painted(page, 0)).toBeVisible();
  await expect(page.getByTestId('board-title')).toHaveValue('Roadmap');
});

test('a duplicate paints the same shapes under a new address, and editing it leaves the original', async ({
  page,
}) => {
  const source = board('board-source', 'Source', 1000, 'shape-source', 0);
  await openLibrary(page, [source]);
  const original = await readStoredBoard(page, 'board-source');

  await rowOf(page, 'Source').getByTestId('duplicate-board').click();
  await expect(rowOf(page, 'Source copy')).toBeVisible();

  const copy = (await record(page))?.boards.find(
    ({ id }) => id !== 'board-source'
  );
  if (copy === undefined) {
    throw new Error('the duplicate has no record entry');
  }
  expect(copy.title).toBe('Source copy');

  await openAt(page, copy.id);
  await expect(painted(page, 0)).toBeVisible();

  const copyBytes = await storedPayload(page, copy.id);
  expect(copyBytes.id).toBe(copy.id);
  expect(copyBytes.shapes).toEqual(source.shapes);
  expect(await readStoredBoard(page, 'board-source')).toBe(original);

  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
  const edited = await storedPayload(page, copy.id);
  expect(edited.shapes).not.toEqual(source.shapes);
  expect(edited.shapes[0].id).toBe('shape-source');
  expect(await readStoredBoard(page, 'board-source')).toBe(original);

  await openAt(page, 'board-source');
  await expect(painted(page, 0)).toBeVisible();
  await expect(painted(page, 300)).toBeHidden();
});

test('delete asks first, and cancelling leaves the board and its bytes untouched', async ({
  page,
}) => {
  await openLibrary(page, [
    board('board-kept', 'Kept', 2000, 'shape-kept', 0),
    board('board-doomed', 'Doomed', 1000, 'shape-doomed', 400),
  ]);
  const doomed = await readStoredBoard(page, 'board-doomed');

  await rowOf(page, 'Doomed').getByTestId('delete-board').click();
  const dialog = page.getByTestId('delete-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Doomed');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(rowOf(page, 'Doomed')).toBeVisible();
  expect(await readStoredBoard(page, 'board-doomed')).toBe(doomed);

  await rowOf(page, 'Doomed').getByTestId('delete-board').click();
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('confirm-delete').click();

  await expect(rowOf(page, 'Kept')).toBeVisible();
  await expect.poll(() => readStoredBoard(page, 'board-doomed')).toBeNull();
  await expect(page.getByTestId('library').getByText('Doomed')).toHaveCount(0);
  expect((await record(page))?.boards.map(({ id }) => id)).toEqual([
    'board-kept',
  ]);
  expect(await readStoredKey(page, quarantineKey('board-doomed'))).toBeNull();
});

test('every row action answers the keyboard', async ({ page }) => {
  await openLibrary(page, [board('board-keys', 'Keys', 1000, 'shape', 0)]);
  const row = rowOf(page, 'Keys');

  await row.getByTestId('rename-board').focus();
  await page.keyboard.press('Enter');
  const input = page.getByTestId('rename-input');
  await expect(input).toBeFocused();
  await input.fill('Never');
  await page.keyboard.press('Escape');
  await expect(rowOf(page, 'Keys')).toBeVisible();

  await rowOf(page, 'Keys').getByTestId('duplicate-board').focus();
  await page.keyboard.press('Enter');
  const copy = rowOf(page, 'Keys copy');
  await expect(copy).toBeVisible();

  await copy.getByTestId('delete-board').focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByTestId('delete-dialog');
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.closest('dialog') !== null)
    )
    .toBe(true);

  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(copy).toBeHidden();
  await expect(rowOf(page, 'Keys')).toBeVisible();
  expect((await record(page))?.boards.map(({ id }) => id)).toEqual([
    'board-keys',
  ]);
  expect(
    await readStoredKey(page, boardStorageKey('board-keys'))
  ).not.toBeNull();
});
