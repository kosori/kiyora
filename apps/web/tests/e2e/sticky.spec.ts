import { expect, type Page, test } from '@playwright/test';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  // The measurer wraps in the hand-drawn face; wait for it so a sticky grows by
  // the metrics it will be painted with, not the fallback's wider ones.
  await page.evaluate(async () => {
    await document.fonts.load("16px 'Balsamiq Sans Neue'");
    await document.fonts.ready;
  });
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

/** The topmost painted path: the sticky a gesture just placed. */
const stickyPath = (page: Page) => board(page).locator('path').last();

const LONG =
  'Remember to ship the note before the demo, then walk the deck once more and close the loop with the team on Friday, and after that send the summary to everyone who could not make it and file the follow-ups in the board';

/** The height a rectangle path spans, read from its own coordinates. */
const pathHeight = (d: string): number => {
  const values = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const ys = values.filter((_, index) => index % 2 === 1);

  return Math.max(...ys) - Math.min(...ys);
};

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
};

test('a sticky lands on the canvas and paints a visible note fill', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('s');
  await page.mouse.click(box.x + 400, box.y + 300);

  const note = stickyPath(page);
  await expect(note).toHaveAttribute('fill', '#f2c037');
  await expect(note).not.toHaveAttribute('fill', 'none');
  await expect(note).toHaveAttribute('stroke', '#1e1e1e');
});

test('typing a long label grows the sticky, and a neighbour is not moved', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  const neighbour = board(page).locator('path').first();
  const neighbourBefore = await neighbour.getAttribute('d');

  await page.keyboard.press('s');
  await page.mouse.click(box.x + 500, box.y + 300);

  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill(LONG);
  await editor.blur();

  const note = stickyPath(page);
  const grown = (await note.getAttribute('d')) ?? '';

  expect(pathHeight(grown)).toBeGreaterThan(160);
  await expect(note).toHaveAttribute('fill', '#f2c037');
  await expect(note).not.toHaveAttribute('fill', 'none');
  expect(await neighbour.getAttribute('d')).toBe(neighbourBefore);
});

test('a sticky growing inside a frame does not resize the frame', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('f');
  await drag(
    page,
    { x: box.x + 100, y: box.y + 100 },
    { x: box.x + 500, y: box.y + 400 }
  );

  const framePath = board(page).locator('path').nth(1);
  const frameBefore = await framePath.getAttribute('d');

  await page.keyboard.press('s');
  await page.mouse.click(box.x + 300, box.y + 250);

  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill(LONG);
  await editor.blur();

  expect(
    pathHeight((await stickyPath(page).getAttribute('d')) ?? '')
  ).toBeGreaterThan(160);
  await expect(framePath).toHaveAttribute('d', frameBefore ?? '');
});
