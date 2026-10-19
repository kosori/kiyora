import { readFile } from 'node:fs/promises';
import { expect, type Locator, type Page, test } from '@playwright/test';

const drawn = {
  d: 'M 200 150 L 400 150 L 400 300 L 200 300 Z',
  fill: 'rgba(25, 113, 194, 0.2)',
  stroke: '#1e1e1e',
};

const drawnSecond = 'M 60 320 L 260 320 L 260 470 L 60 470 Z';

const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
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

const rectangle = (page: Page): Locator =>
  page.getByTestId('board').locator(`path[d="${drawn.d}"]`);

const saveFile = async (page: Page): Promise<string> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-file').click(),
  ]);

  return readFile(await download.path(), 'utf8');
};

const openFile = async (
  page: Page,
  name: string,
  bytes: string
): Promise<void> => {
  await page.getByTestId('file-input').setInputFiles({
    buffer: Buffer.from(bytes, 'utf8'),
    mimeType: 'application/json',
    name,
  });
};

test('the board is saved as one file, and opening it brings the board back', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-file').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.kyr\.json$/);

  const first = await readFile(await download.path(), 'utf8');

  await drawRectangle(page, { x: 60, y: 320 });
  await expect(
    page.getByTestId('board').locator(`path[d="${drawnSecond}"]`)
  ).toBeVisible();

  await openFile(page, 'board.kyr.json', first);

  await expect(
    page.getByTestId('board').locator(`path[d="${drawnSecond}"]`)
  ).toBeHidden();
  await expect(rectangle(page)).toHaveAttribute('fill', drawn.fill);
  await expect(rectangle(page)).toHaveAttribute('stroke', drawn.stroke);
  await expect(rectangle(page)).toHaveAttribute('stroke-width', '2');

  const again = await saveFile(page);
  expect(again).toBe(first);
});

test('an invalid file is refused, and the board it would replace is left untouched', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  const before = await saveFile(page);

  await openFile(page, 'notes.txt', 'this is not a board');
  await expect(page.getByTestId('file-error')).toContainText(/JSON/);

  await openFile(page, 'board.kyr.json', '{"id":"board-1"}');
  await expect(page.getByTestId('file-error')).toContainText(/shapes/);

  await expect(rectangle(page)).toHaveAttribute('fill', drawn.fill);

  const after = await saveFile(page);
  expect(after).toBe(before);
});
