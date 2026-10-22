import { readFile } from 'node:fs/promises';
import { ICONS } from '@kiyora/model/icons';
import { expect, type Page, test } from '@playwright/test';

/** The icon these tests place, and the path the dataset holds for it. */
const ICON = 'star';
const PATH = ICONS[ICON];

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

/** Picks `star` from the library, then drags the box it should fill. */
const placeStar = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);

  await page.getByTestId('icon-picker').click();
  const menu = page.getByTestId('icon-picker-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Star' }).click();

  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 400, y: box.y + 300 }
  );
};

const iconPath = (page: Page, id = 'icon-1') =>
  page.getByTestId('board').locator(`path[data-shape="${id}"]`);

test('the dataset is fetched when the picker opens, never before', async ({
  page,
}) => {
  /** The largest body any icon-dataset chunk has transferred, in bytes. */
  const datasetBytes = (): Promise<number> =>
    page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('icons_dataset'))
        .reduce(
          (largest, entry) =>
            Math.max(
              largest,
              (entry as PerformanceResourceTiming).encodedBodySize
            ),
          0
        )
    );

  await open(page);

  // The dev server fetches the async loader's tiny stub with the parent chunk;
  // the dataset itself is the thousands of bytes behind it, and must be absent.
  expect(await datasetBytes()).toBeLessThan(1024);

  await page.getByTestId('icon-picker').click();
  await expect(page.getByTestId('icon-picker-menu')).toBeVisible();
  await expect(
    page.getByTestId('icon-picker-menu').getByRole('menuitem', { name: 'Star' })
  ).toBeVisible();

  await expect.poll(datasetBytes).toBeGreaterThan(1024);
});

test('placing an icon paints its path, fitted and turned with the box', async ({
  page,
}) => {
  await open(page);
  await placeStar(page);

  const placed = iconPath(page);

  await expect(placed).toHaveAttribute('d', PATH);
  await expect(placed).toHaveAttribute('fill', 'none');
  await expect(placed).toHaveAttribute('stroke', '#1e1e1e');
  await expect(placed).toHaveAttribute(
    'transform',
    'rotate(0 300 225) translate(225 150) scale(6.25)'
  );
});

test('an icon survives a reload and is painted from the dataset again', async ({
  page,
}) => {
  await open(page);
  await placeStar(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect(iconPath(page)).toHaveAttribute('d', PATH);
});

test('the SVG export carries the icon path and no reference to the library', async ({
  page,
}) => {
  await open(page);
  await placeStar(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await download.path(), 'utf8');

  expect(svg).toContain(`d="${PATH}"`);
  expect(svg).toContain(
    'transform="rotate(0 300 225) translate(225 150) scale(6.25)"'
  );
  expect(svg.match(/https?:\/\/[^"')\s]+/g)).toEqual([
    'http://www.w3.org/2000/svg',
  ]);
  expect(svg).not.toMatch(/\b(href|src)=/);
});

test('the clipboard round-trips an icon as plain board data', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await placeStar(page);

  await page.mouse.click(box.x + 300, box.y + 225);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');

  await expect(iconPath(page, 'icon-2')).toHaveAttribute('d', PATH);
  await expect(iconPath(page)).toHaveAttribute('d', PATH);
});
