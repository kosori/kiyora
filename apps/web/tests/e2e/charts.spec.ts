import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * Charts, driven at the browser seam: a chart is placed, its authored series is
 * replaced through the inspector, one undo returns the paint, and the same
 * paths reach the SVG artifact. The series is stored as numbers, so the test
 * reads the painted paths rather than an element count.
 */

/** Wait for the vendored typeface, so label measurement is the same before and after a reload. */
const fontsReady = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.load('16px "Balsamiq Sans Neue"');
    await document.fonts.ready;
  });
};

const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await fontsReady(page);
};

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

/** The paths a chart paints, in paint order, exactly as the canvas drew them. */
const chartPaths = (page: Page): Promise<string[]> =>
  board(page)
    .locator('path[data-shape^="chart-"]')
    .evaluateAll((paths) =>
      paths.flatMap((path) => {
        const d = path.getAttribute('d');
        return d === null ? [] : [d];
      })
    );

const saved = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
};

/** Places a chart by clicking the rail tool and then the canvas. */
const placeChart = async (
  page: Page,
  point: { x: number; y: number }
): Promise<void> => {
  await page.getByRole('button', { name: 'Chart' }).click();
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => chartPaths(page)).not.toEqual([]);
};

test('a placed chart repaints when its series changes, and one undo returns it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const point = { x: box.x + 600, y: box.y + 300 };

  await placeChart(page, point);
  const placed = await chartPaths(page);

  expect(placed.length).toBeGreaterThan(1);

  await page.mouse.click(point.x, point.y);
  const series = page.getByTestId('chart-series');
  await expect(series).toHaveValue('4, 8, 6, 10');

  await series.fill('12, 3, 9, 6');
  await series.press('Enter');

  const changed = await chartPaths(page);
  expect(changed).not.toEqual(placed);

  await page.keyboard.press('Control+z');

  expect(await chartPaths(page)).toEqual(placed);
});

test('a changed chart survives a reload, and its paths match the SVG export', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const point = { x: box.x + 600, y: box.y + 300 };

  await placeChart(page, point);
  await page.mouse.click(point.x, point.y);

  const series = page.getByTestId('chart-series');
  await series.fill('3, 14, 2, 11');
  await series.press('Enter');
  const changed = await chartPaths(page);
  await saved(page);

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await fontsReady(page);
  // A repaint after the font settles, so the canvas is measured by the loaded face.
  await page.keyboard.press('=');
  await page.keyboard.press('-');
  await expect.poll(() => chartPaths(page)).toEqual(changed);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await download.path(), 'utf8');
  const exported = [...svg.matchAll(/<path d="([^"]*)"/g)].map(
    ([, d]) => d ?? ''
  );

  expect(exported).toEqual(expect.arrayContaining(changed));
});

test('a chart can change kind without losing its series', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);
  const point = { x: box.x + 600, y: box.y + 300 };

  await placeChart(page, point);
  await page.mouse.click(point.x, point.y);
  const before = await chartPaths(page);

  await page.getByTestId('chart-kind-pie').click();

  const after = await chartPaths(page);
  expect(after).not.toEqual(before);

  await page.getByTestId('chart-kind-column').click();

  expect(await chartPaths(page)).toEqual(before);
});
