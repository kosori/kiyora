import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

/**
 * The acceptance journey: one test that walks the whole product the way a
 * person would — open, draw, connect, label, move, reload, export, present —
 * and does it with every request that is not to localhost aborted. The offline
 * guard is not a separate claim here: the journey runs behind it, so the board
 * is proven to survive the whole walk with the network off.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The pixel box a PNG declares in its own IHDR chunk, read from the file a person would get. */
const pngSize = (bytes: Buffer): { height: number; width: number } => ({
  height: bytes.readUInt32BE(20),
  width: bytes.readUInt32BE(16),
});

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

/** A shape's clean geometry, keyed by the id the store minted for it. */
const clean = (page: Page, id: string) =>
  board(page).locator(`path[data-shape="${id}"]`);

/** A connector's own line, before its arrowhead. */
const connectorLine = (page: Page) =>
  board(page).locator('path[data-shape="connector-1"][fill="none"]');

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
};

/** The board's origin, so a board point can be turned into a page point. */
const at = (
  box: { x: number; y: number },
  point: { x: number; y: number }
) => ({ x: box.x + point.x, y: box.y + point.y });

/** Draws a figure from the picker, whose shapes are not on the rail. */
const drawFromPicker = async (
  page: Page,
  box: { x: number; y: number },
  name: string,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.getByTestId('shape-picker').click();
  await page.getByRole('menuitem', { name }).click();
  await drag(page, at(box, from), at(box, to));
};

test('the whole journey passes with every non-localhost request aborted', async ({
  page,
}) => {
  const blocked: string[] = [];

  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    if (LOCAL_HOSTS.has(hostname)) {
      return route.continue();
    }
    blocked.push(route.request().url());
    return route.abort();
  });

  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  const box = await canvasBox(page);

  // Draw a rectangle and an ellipse, clear of the starter board and the panels.
  await page.keyboard.press('r');
  await drag(page, at(box, { x: 40, y: 320 }), at(box, { x: 200, y: 420 }));
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 40 320 L 200 320 L 200 420 L 40 420 Z'
  );

  await drawFromPicker(
    page,
    box,
    'Ellipse',
    { x: 300, y: 320 },
    { x: 460, y: 420 }
  );
  await expect(clean(page, 'ellipse-1')).not.toHaveAttribute('d', '');

  // Join the two, and the connector paints a real line between them.
  await page.keyboard.press('c');
  await drag(page, at(box, { x: 120, y: 370 }), at(box, { x: 380, y: 370 }));
  await expect(connectorLine(page)).toHaveAttribute('fill', 'none');
  await expect(connectorLine(page)).toHaveAttribute('stroke', '#1e1e1e');

  // A heading and a sticky, typed on the canvas rather than into a dialog.
  await page.keyboard.press('t');
  await page.mouse.click(box.x + 60, box.y + 560);
  const text = page.getByTestId('text-editor');
  await expect(text).toBeVisible();
  await text.fill('Heading');
  await text.blur();

  await page.keyboard.press('s');
  await page.mouse.click(box.x + 560, box.y + 560);
  const sticky = page.getByTestId('text-editor');
  await expect(sticky).toBeVisible();
  await sticky.fill('Remember the demo');
  await sticky.blur();

  await expect(
    board(page).locator('text', { hasText: 'Heading' })
  ).toBeVisible();
  await expect(clean(page, 'sticky-1')).toHaveAttribute('fill', '#f2c037');
  await expect(clean(page, 'sticky-1')).not.toHaveAttribute('fill', 'none');

  // Select the rectangle and move the selection; the connector re-routes with it.
  await page.mouse.click(box.x + 100, box.y + 340);
  await expect(page.getByTestId('selection-frame')).toBeVisible();
  await drag(page, at(box, { x: 100, y: 340 }), at(box, { x: 100, y: 300 }));
  const MOVED = 'M 40 280 L 200 280 L 200 380 L 40 380 Z';
  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', MOVED);

  // Reload, and confirm the board survived exactly as it was left.
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', MOVED);
  await expect(connectorLine(page)).toHaveAttribute('fill', 'none');
  await expect(connectorLine(page)).toHaveAttribute('stroke', '#1e1e1e');
  await expect(clean(page, 'sticky-1')).toHaveAttribute('fill', '#f2c037');
  await expect(
    board(page).locator('text', { hasText: 'Heading' })
  ).toBeVisible();

  // Export the board as PNG at 2×, then as SVG, and cross-check the two.
  await page.getByTestId('png-options').click();
  await page.getByTestId('png-scale-2').click();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-png').click(),
  ]);
  const pixels = pngSize(await readFile(await png.path()));

  const [svgDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await svgDownload.path(), 'utf8');
  const viewBox = (/viewBox="([^"]*)"/.exec(svg)?.[1] ?? '')
    .split(/\s+/)
    .map(Number);

  expect(pixels.width).toBe(Math.round((viewBox[2] ?? 0) * 2));
  expect(pixels.height).toBe(Math.round((viewBox[3] ?? 0) * 2));
  expect(pixels.width).toBeGreaterThan(0);
  expect(svg).toContain('stroke="#1e1e1e"');

  // Two slides from the deck's templates, then presenting plays them fullscreen.
  await page.getByTestId('png-options').click();
  await page.getByTestId('template-title').click();
  await page.getByTestId('template-blank').click();
  await expect(page.getByTestId('slide')).toHaveCount(2);

  await page.getByTestId('present-button').click();
  const overlay = page.getByTestId('present-overlay');
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId('present-counter')).toHaveText('1 / 2');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('present-counter')).toHaveText('2 / 2');

  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(page.getByTestId('deck')).toBeVisible();

  expect(blocked).toEqual([]);
});
