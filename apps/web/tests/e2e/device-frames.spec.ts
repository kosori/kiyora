import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '../fixtures/offline';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

const clean = (page: Page, id: string) =>
  board(page).locator(`path[data-shape="${id}"]`);

const frame = { h: 300, w: 400, x: 100, y: 100 };

/** The frame's plain body: one authored box and no chrome. */
const PLAIN = 'M 100 100 L 500 100 L 500 400 L 100 400 Z';

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 6 });
  await page.mouse.up();
};

/** Selects the frame by clicking a corner no member covers. */
const selectFrame = async (page: Page) => {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + frame.x + frame.w - 20, box.y + frame.y + 280);
};

const drawFrame = async (page: Page) => {
  await page.keyboard.press('f');
  await drag(
    page,
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.w, y: frame.y + frame.h }
  );
  await selectFrame(page);
};

const openInspector = async (page: Page) => {
  await page.getByTestId('rail-tab-inspector').click();
};

const exportSvg = async (page: Page): Promise<string> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);

  return readFile(await download.path(), 'utf8');
};

test('choosing a phone variant repaints the chrome, and one undo puts plain back', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);

  const framePaths = clean(page, 'frame-1');

  await expect(framePaths.first()).toHaveAttribute('d', PLAIN);

  await page.getByTestId('frame-variant-phone').click();

  await expect(framePaths.first()).not.toHaveAttribute('d', PLAIN);
  await expect(framePaths.first()).toHaveAttribute('d', /C /);
  await expect(framePaths.nth(1)).toHaveAttribute(
    'd',
    'M 115 115 L 485 115 L 485 385 L 115 385 Z'
  );

  await page.getByTestId('undo').click();

  await expect(framePaths.first()).toHaveAttribute('d', PLAIN);
});

test('the variant survives a reload, so the chrome is authored and autosaved', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);

  await page.getByTestId('frame-variant-tablet').click();
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await openInspector(page);
  await selectFrame(page);

  await expect(page.getByTestId('frame-variant-tablet')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(clean(page, 'frame-1').first()).not.toHaveAttribute('d', PLAIN);
});

test('the browser variant paints on the canvas and the export carries the same paths', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);

  await page.getByTestId('frame-variant-browser').click();

  const painted = await clean(page, 'frame-1').evaluateAll((paths) =>
    paths.map((path) => path.getAttribute('d') ?? '')
  );
  const svg = await exportSvg(page);

  expect(painted[1]).toBe('M 100 100 L 500 100 L 500 140 L 100 140 Z');

  for (const d of painted) {
    expect(svg).toContain(`d="${d}"`);
  }
});

test('a member at the frame\u2019s top-left stays visible after the switch, not under the chrome', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await page.keyboard.press('r');
  await drag(page, { x: 110, y: 110 }, { x: 210, y: 160 });

  const memberPath = 'M 110 110 L 210 110 L 210 160 L 110 160 Z';
  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', memberPath);

  await selectFrame(page);
  await page.getByTestId('frame-variant-phone').click();

  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', memberPath);
  await expect(board(page).locator('clipPath path')).toHaveAttribute(
    'd',
    PLAIN
  );

  const order = await board(page)
    .locator('path[data-shape]')
    .evaluateAll((paths) =>
      paths.map((path) => path.getAttribute('data-shape'))
    );

  expect(order.lastIndexOf('frame-1')).toBeLessThan(
    order.indexOf('rectangle-1')
  );
});
