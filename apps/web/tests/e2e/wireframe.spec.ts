import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '../fixtures/offline';
import { paintedDs } from './paint';

/** The control these tests place, and the two paths its paint consists of. */
const OUTLINE = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';
const DETAIL = 'M 260 225 L 340 225';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

/** The canvas's place on the screen, so board coordinates can be dragged to exactly. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const placed = (page: Page) =>
  page.getByTestId('board').locator('path[data-shape="button-1"]');

/** Picks a control from the whole vocabulary, then drags the box it should fill. */
const placeButton = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);

  await page.getByTestId('shape-picker').click();
  await page
    .getByTestId('shape-picker-menu')
    .getByRole('menuitem', { exact: true, name: 'Button' })
    .click();

  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300, { steps: 6 });
  await page.mouse.up();
};

test('every control is offered by the one shape picker', async ({ page }) => {
  const controls = [
    'Avatar',
    'Badge',
    'Breadcrumb',
    'Button',
    'Card',
    'Checkbox',
    'Divider',
    'Dropdown',
    'Input',
    'Pagination',
    'Radio',
    'Slider',
    'Table',
    'Tabs',
    'Text Area',
    'Toggle',
  ];

  await open(page);
  await page.getByTestId('shape-picker').click();

  const menu = page.getByTestId('shape-picker-menu');
  await expect(menu).toBeVisible();

  await Promise.all(
    controls.map((name) =>
      expect(menu.getByRole('menuitem', { exact: true, name })).toBeVisible()
    )
  );
});

test('a placed button paints its own geometry, reloads, and exports the same paths', async ({
  page,
}) => {
  await open(page);
  await placeButton(page);

  const paths = placed(page);
  await expect(paths.first()).toHaveAttribute('d', OUTLINE);
  await expect(paths.first()).toHaveAttribute(
    'fill',
    'rgba(25, 113, 194, 0.2)'
  );
  await expect(paths.nth(1)).toHaveAttribute('d', DETAIL);
  await expect(paths.nth(1)).toHaveAttribute('fill', 'none');
  expect(await paintedDs(paths)).toEqual([OUTLINE, DETAIL]);

  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
  await expect(placed(page).first()).toHaveAttribute('d', OUTLINE);
  await expect(placed(page).nth(1)).toHaveAttribute('d', DETAIL);

  const painted = await placed(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('d') ?? '')
  );
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await download.path(), 'utf8');

  expect(painted).toEqual([OUTLINE, DETAIL]);
  for (const d of painted) {
    expect(svg).toContain(`d="${d}"`);
  }
});
