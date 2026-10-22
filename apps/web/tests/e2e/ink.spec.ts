import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { boardOfManyStrokes, STROKE_COUNT } from './ink-board';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
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

/** The stroke of one mode, by the id prefix the pen and highlighter mint. */
const strokes = (page: Page, mode: 'ink' | 'highlighter') =>
  board(page).locator(`path[data-shape^="${mode}-"]`);

/** Draws a stroke in small steps, so the simplifier sees a sampled path. */
const drawStroke = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 30 });
  await page.mouse.up();
};

const choose = async (page: Page, key: string) => {
  await page.keyboard.press(key);
};

test('a drawn stroke paints as one path, and undo removes the whole stroke', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await choose(page, 'i');
  await drawStroke(
    page,
    { x: box.x + 380, y: box.y + 380 },
    { x: box.x + 700, y: box.y + 440 }
  );

  const stroke = strokes(page, 'ink');
  const d = await stroke.getAttribute('d');
  expect(d).toMatch(/^M [\d.]+ [\d.]+ A /);
  await expect(stroke).toHaveAttribute('fill', '#1e1e1e');
  await expect(stroke).toHaveAttribute('stroke', 'none');

  // A quarter of a thousand samples is still one DOM node, not hundreds.
  expect(await board(page).locator('*').count()).toBeLessThan(20);

  await page.keyboard.press('Control+z');

  await expect(stroke).toBeHidden();
});

test('a pen stroke tapers with the pressure it reports, and the mouse stroke stays even', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const from = { x: box.x + 420, y: box.y + 300 };
  const to = { x: box.x + 760, y: box.y + 300 };

  await choose(page, 'i');
  await drawStroke(page, from, to);
  const mouse = await strokes(page, 'ink').first().getAttribute('d');

  await choose(page, 'i');
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchMouseEvent', {
    button: 'left',
    buttons: 1,
    clickCount: 1,
    force: 0.15,
    pointerType: 'pen',
    type: 'mousePressed',
    x: from.x,
    y: from.y,
  });
  for (let step = 1; step <= 30; step += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: the samples must land in order, as a pen would
    await client.send('Input.dispatchMouseEvent', {
      button: 'left',
      buttons: 1,
      force: 0.15 + (step / 30) * 0.8,
      pointerType: 'pen',
      type: 'mouseMoved',
      x: from.x + ((to.x - from.x) * step) / 30,
      y: from.y,
    });
  }
  await client.send('Input.dispatchMouseEvent', {
    button: 'left',
    buttons: 0,
    clickCount: 1,
    force: 0,
    pointerType: 'pen',
    type: 'mouseReleased',
    x: to.x,
    y: to.y,
  });

  await expect(strokes(page, 'ink').nth(1)).toBeVisible();
  const pen = await strokes(page, 'ink').nth(1).getAttribute('d');

  expect(mouse).not.toBeNull();
  expect(pen).not.toBeNull();
  expect(pen).not.toBe(mouse);
});

test('a stroke survives a reload with the same painted path', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await choose(page, 'i');
  await drawStroke(
    page,
    { x: box.x + 400, y: box.y + 380 },
    { x: box.x + 720, y: box.y + 470 }
  );

  const painted = await strokes(page, 'ink').getAttribute('d');
  expect(painted).not.toBeNull();
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  const afterReload = strokes(page, 'ink');
  await expect(afterReload).toHaveAttribute('d', painted ?? '');
});

test('the exported SVG carries the same stroke path the canvas painted', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await choose(page, 'i');
  await drawStroke(
    page,
    { x: box.x + 380, y: box.y + 420 },
    { x: box.x + 690, y: box.y + 390 }
  );

  const painted = await strokes(page, 'ink').getAttribute('d');
  expect(painted).not.toBeNull();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await download.path(), 'utf8');

  expect(svg).toContain(`d="${painted ?? ''}"`);
  expect(svg).toContain('stroke="none"');
});

test('a highlighter is translucent and paints behind the words it crosses', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await choose(page, 't');
  await page.mouse.click(box.x + 360, box.y + 260);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Ink text');
  await editor.blur();
  await expect(board(page).locator('text')).toContainText('Ink text');

  await choose(page, 'h');
  await drawStroke(
    page,
    { x: box.x + 260, y: box.y + 270 },
    { x: box.x + 540, y: box.y + 270 }
  );

  const band = strokes(page, 'highlighter');
  await expect(band).toHaveAttribute('fill', 'rgba(30, 30, 30, 0.35)');
  await expect(band).toHaveAttribute('stroke', 'none');

  const behind = await board(page).evaluate((node) => {
    const ink = node.querySelector('path[data-shape^="highlighter-"]');
    const text = node.querySelector('text');
    if (ink === null || text === null) {
      return false;
    }
    const painted = Array.from(
      node.querySelectorAll('path[data-shape^="highlighter-"], text')
    );
    return painted.indexOf(ink) < painted.indexOf(text);
  });
  expect(behind).toBe(true);
});

test('a board of many strokes keeps the DOM to the view', async ({ page }) => {
  await page.addInitScript((bytes: string) => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    localStorage.setItem('kiyora:board', bytes);
  }, JSON.stringify(boardOfManyStrokes()));

  await open(page);

  const nodes = await board(page).evaluate(
    (element) => element.querySelectorAll('*').length
  );
  expect(nodes).toBeGreaterThan(0);
  expect(nodes).toBeLessThan(250);

  await expect(strokes(page, 'ink').first()).toHaveAttribute(
    'd',
    /^M [\d.]+ [\d.]+ A /
  );
  await expect(
    board(page).locator(`path[data-shape="ink-${STROKE_COUNT - 1}"]`)
  ).toBeHidden();
});
