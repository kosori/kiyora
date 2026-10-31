import { LIBRARY_KEY } from '@kiyora/editor';
import {
  openLibrary,
  readStoredBoard,
  readStoredKey,
} from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * The library acceptance journey: one test that creates, draws, reloads,
 * renames, duplicates, edits, deletes and reopens boards the way a person does,
 * with every request — the app's own included — aborted. Every step reads paint
 * or stored bytes, never how many nodes a page holds.
 */

const DRAWN = {
  d: 'M 200 150 L 400 150 L 400 300 L 200 300 Z',
  fill: 'rgba(25, 113, 194, 0.2)',
};

const COPIED = {
  d: 'M 500 150 L 650 150 L 650 250 L 500 250 Z',
  fill: 'rgba(25, 113, 194, 0.2)',
};

const LATER = {
  d: 'M 200 400 L 400 400 L 400 550 L 200 550 Z',
  fill: 'rgba(25, 113, 194, 0.2)',
};

type StoredShape = {
  h: number;
  id: string;
  w: number;
  x: number;
  y: number;
};

type StoredBoard = {
  id: string;
  shapes: StoredShape[];
  title: string;
};

type StoredRecord = {
  boards: { id: string; title: string }[];
};

const rowOf = (page: Page, id: string) =>
  page.locator(`[data-testid="library-row"][data-board-id="${id}"]`);

const previewOf = (page: Page, id: string) =>
  rowOf(page, id).getByTestId('board-preview');

const painted = (page: Page, d: string) =>
  page.getByTestId('board').locator(`path[d="${d}"]`);

const storedBoard = async (
  page: Page,
  id: string
): Promise<StoredBoard | null> => {
  const bytes = await readStoredBoard(page, id);
  return bytes === null ? null : (JSON.parse(bytes) as StoredBoard);
};

const storedRecord = async (page: Page): Promise<StoredRecord | null> => {
  const bytes = await readStoredKey(page, LIBRARY_KEY);
  return bytes === null ? null : (JSON.parse(bytes) as StoredRecord);
};

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const draw = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<void> => {
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 });
  await page.mouse.up();
};

const openAt = async (page: Page, id: string): Promise<void> => {
  await page.goto(`/b/${id}`);
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
};

const saved = (page: Page) =>
  expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

test.describe('the library with every request aborted', () => {
  test.use({ offlineMode: 'local-api' });

  test('a board is created, drawn, renamed, duplicated, edited, deleted and reopened', async ({
    page,
  }) => {
    await openLibrary(page);

    await page.getByTestId('new-board').click();
    await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const originalId = new URL(page.url()).pathname.split('/').at(-1) ?? '';
    await expect(page.getByTestId('canvas')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout: 30_000 }
    );

    await draw(page, { x: 200, y: 150 }, { x: 400, y: 300 });
    await expect(painted(page, DRAWN.d)).toHaveAttribute('fill', DRAWN.fill);
    await saved(page);

    await page.reload();
    await expect(page.getByTestId('canvas')).toHaveAttribute(
      'data-ready',
      'true'
    );
    await expect(painted(page, DRAWN.d)).toHaveAttribute('fill', DRAWN.fill);

    await page.goto('/');
    await expect(
      previewOf(page, originalId).locator(`path[d="${DRAWN.d}"]`)
    ).toHaveAttribute('fill', DRAWN.fill);

    await rowOf(page, originalId).getByTestId('rename-board').click();
    const name = page.getByTestId('rename-input');
    await name.fill('Offline plan');
    await name.press('Enter');
    await expect
      .poll(async () => (await storedBoard(page, originalId))?.title)
      .toBe('Offline plan');
    await expect
      .poll(
        async () =>
          (await storedRecord(page))?.boards.find(({ id }) => id === originalId)
            ?.title
      )
      .toBe('Offline plan');

    await page.reload();
    await expect(
      previewOf(page, originalId).locator(`path[d="${DRAWN.d}"]`)
    ).toHaveAttribute('fill', DRAWN.fill);

    const original = await storedBoard(page, originalId);
    if (original === null) {
      throw new Error('the original board has no stored bytes');
    }

    await rowOf(page, originalId).getByTestId('duplicate-board').click();
    await expect
      .poll(
        async () =>
          (await storedRecord(page))?.boards.find(({ id }) => id !== originalId)
            ?.title
      )
      .toBe('Offline plan copy');
    const copyId =
      (await storedRecord(page))?.boards.find(({ id }) => id !== originalId)
        ?.id ?? '';
    expect(copyId).not.toBe(originalId);

    const copyBytes = await storedBoard(page, copyId);
    expect(copyBytes?.id).toBe(copyId);
    expect(copyBytes?.title).toBe('Offline plan copy');
    expect(copyBytes?.shapes).toEqual(original.shapes);
    await expect(
      previewOf(page, copyId).locator(`path[d="${DRAWN.d}"]`)
    ).toHaveAttribute('fill', DRAWN.fill);

    await openAt(page, copyId);
    await expect(painted(page, DRAWN.d)).toHaveAttribute('fill', DRAWN.fill);
    await draw(page, { x: 500, y: 150 }, { x: 650, y: 250 });
    await expect(painted(page, COPIED.d)).toHaveAttribute('fill', COPIED.fill);
    await saved(page);

    const editedCopy = await storedBoard(page, copyId);
    expect(editedCopy?.shapes).toContainEqual(
      expect.objectContaining({ h: 100, w: 150, x: 500, y: 150 })
    );
    expect(await storedBoard(page, originalId)).toEqual(original);

    await page.goto('/');
    await expect(
      previewOf(page, copyId).locator(`path[d="${COPIED.d}"]`)
    ).toHaveAttribute('fill', COPIED.fill);
    await expect(
      previewOf(page, originalId).locator(`path[d="${COPIED.d}"]`)
    ).toBeHidden();

    await rowOf(page, copyId).getByTestId('delete-board').click();
    await page
      .getByTestId('delete-dialog')
      .getByTestId('confirm-delete')
      .click();

    await expect.poll(() => readStoredBoard(page, copyId)).toBeNull();
    expect(
      (await storedRecord(page))?.boards.map(({ id }) => id)
    ).not.toContain(copyId);
    expect(await storedBoard(page, originalId)).toEqual(original);

    await openAt(page, originalId);
    await expect(painted(page, DRAWN.d)).toHaveAttribute('fill', DRAWN.fill);
    await expect(painted(page, COPIED.d)).toBeHidden();

    await draw(page, { x: 200, y: 400 }, { x: 400, y: 550 });
    await expect(painted(page, LATER.d)).toHaveAttribute('fill', LATER.fill);
    await saved(page);

    const continued = await storedBoard(page, originalId);
    expect(continued?.shapes).toContainEqual(
      expect.objectContaining({ h: 150, w: 200, x: 200, y: 400 })
    );
    expect(continued?.shapes).toContainEqual(original.shapes[0]);
  });
});
