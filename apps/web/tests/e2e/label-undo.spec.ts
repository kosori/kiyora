import { openStarterBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

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

const labels = (page: Page) => board(page).locator('text');

const editor = (page: Page) => page.getByTestId('text-editor');

/** The height a rectangle path spans, read from its own coordinates. */
const pathHeight = (d: string): number => {
  const values = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const ys = values.filter((_, index) => index % 2 === 1);

  return Math.max(...ys) - Math.min(...ys);
};

/**
 * Long enough to outgrow a note's 160-unit box in the vendored font, where the
 * first sentence alone still fits: twelve wrapped lines, so the growth the undo
 * has to take back really happens.
 */
const LONG =
  'Remember to ship the note before the demo, then walk the deck once more and close the loop with the team on Friday. Remember to ship the note before the demo, then walk the deck once more and close the loop with the team on Friday.';

/** The point inside the starter board's rectangle, which is its own label box. */
const RECTANGLE = { x: 190, y: 150 };

/** Double-click a shape and type its label, the way a person edits one. */
const editLabel = async (
  page: Page,
  box: { x: number; y: number },
  words: string
) => {
  await page.mouse.dblclick(box.x + RECTANGLE.x, box.y + RECTANGLE.y);
  const surface = editor(page);
  await expect(surface).toBeVisible();
  await surface.fill(words);
  await surface.blur();
};

test('a finished label edit is one undo, and the painted words come back', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const undo = page.getByTestId('undo');

  await editLabel(page, box, 'Plan');
  await expect(labels(page).first()).toHaveText('Plan');

  await editLabel(page, box, 'Ship it');
  await expect(labels(page).first()).toHaveText('Ship it');

  await undo.click();

  await expect(labels(page).first()).toHaveText('Plan');

  await undo.click();

  await expect(board(page)).not.toContainText('Plan');
  await expect(undo).toBeDisabled();
});

test('Escape mid-edit restores the painted words and leaves nothing to undo', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await editLabel(page, box, 'Plan');

  await page.mouse.dblclick(box.x + RECTANGLE.x, box.y + RECTANGLE.y);
  const surface = editor(page);
  await expect(surface).toBeVisible();
  await surface.fill('Ship it');
  await surface.press('Escape');

  await expect(surface).not.toBeVisible();
  await expect(labels(page).first()).toHaveText('Plan');

  await page.getByTestId('undo').click();

  await expect(board(page)).not.toContainText('Plan');
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('placing a text shape and typing its words is one undo, not two', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.getByRole('button', { name: 'Text' }).click();
  await page.mouse.click(box.x + 500, box.y + 300);

  const surface = editor(page);
  await expect(surface).toBeVisible();
  await surface.fill('Hello board');
  await surface.blur();

  await expect(board(page)).toContainText('Hello board');

  await page.getByTestId('undo').click();

  await expect(board(page)).not.toContainText('Hello board');
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('undoing a note\u2019s label puts its box back, so the note shrinks again', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const NOTE = { x: 500, y: 300 };
  const note = () => board(page).locator('path').last();

  await page.keyboard.press('s');
  await page.mouse.click(box.x + NOTE.x, box.y + NOTE.y);
  const first = editor(page);
  await expect(first).toBeVisible();
  await first.fill('Note');
  await first.blur();

  const small = (await note().getAttribute('d')) ?? '';

  await page.mouse.dblclick(box.x + NOTE.x, box.y + NOTE.y);
  const again = editor(page);
  await expect(again).toBeVisible();
  await again.fill(LONG);
  await again.blur();

  const grown = pathHeight((await note().getAttribute('d')) ?? '');

  expect(grown).toBeGreaterThan(pathHeight(small) + 50);

  await page.getByTestId('undo').click();

  expect(await note().getAttribute('d')).toBe(small);
  await expect(labels(page).first()).toHaveText('Note');
});
