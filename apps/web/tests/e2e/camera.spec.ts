import { expect, type Page, test } from '@playwright/test';

const TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

const camera = async (page: Page): Promise<Camera> => {
  const value = await page.getByTestId('board').getAttribute('transform');
  const match = TRANSFORM.exec(value ?? '');

  if (match === null) {
    throw new Error(`the board is not placed by a camera: ${value}`);
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    zoom: Number(match[3]),
  };
};

/** What the board draws, read from the outside. A camera change must leave it identical. */
const painted = (page: Page) =>
  page
    .getByTestId('canvas')
    .locator('path')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        d: node.getAttribute('d'),
        fill: node.getAttribute('fill'),
        stroke: node.getAttribute('stroke'),
        strokeWidth: node.getAttribute('stroke-width'),
      }))
    );

const viewport = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

/** The rectangle the starter board places: 80,80 at 220x140, in board units. */
const starter = { h: 140, w: 220, x: 80, y: 80 };

/** The board point under a screen point, given the camera reading. */
const under = (view: Camera, x: number, y: number) => ({
  x: (x - view.x) / view.zoom,
  y: (y - view.y) / view.zoom,
});

const gridStep = async (page: Page): Promise<number> => {
  const value = await page.getByTestId('dot-grid').getAttribute('width');

  if (value === null) {
    throw new Error('the grid has no spacing');
  }

  return Number(value);
};

/**
 * The board is server-rendered, so its paint is on screen before React is
 * listening. Every gesture test opens through this, which waits for the surface
 * to say it can act.
 */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

test('the view opens at one hundred percent, and says so', async ({ page }) => {
  await open(page);

  await expect(page.getByTestId('zoom-percentage')).toHaveText('100%');
  expect(await camera(page)).toEqual({ x: 0, y: 0, zoom: 1 });
});

test('the middle button drags the board, and the board underneath never changes', async ({
  page,
}) => {
  await open(page);

  const before = await painted(page);

  await page.mouse.move(600, 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(660, 340, { steps: 5 });
  await page.mouse.up({ button: 'middle' });

  const moved = await camera(page);

  expect(moved.x).toBeCloseTo(60, 0);
  expect(moved.y).toBeCloseTo(40, 0);
  expect(moved.zoom).toBe(1);
  expect(await painted(page)).toEqual(before);
});

test('holding space drags the board, and lets go when space lets go', async ({
  page,
}) => {
  await open(page);

  await page.keyboard.down('Space');
  await page.mouse.move(600, 300);
  await page.mouse.down();
  await page.mouse.move(560, 260, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up('Space');

  expect((await camera(page)).x).toBeCloseTo(-40, 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.mouse.move(600, 300);
  await page.mouse.down();
  await page.mouse.move(500, 300, { steps: 3 });
  await page.mouse.up();

  expect((await camera(page)).x).toBeCloseTo(-40, 0);
});

test('the hand tool drags the board, and hands back to select', async ({
  page,
}) => {
  await open(page);

  await page.getByTestId('hand-tool').click();
  await expect(page.getByTestId('hand-tool')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.mouse.move(600, 300);
  await page.mouse.down();
  await page.mouse.move(700, 350, { steps: 4 });
  await page.mouse.up();

  expect((await camera(page)).x).toBeCloseTo(100, 0);

  await page.getByTestId('hand-tool').click();
  await expect(page.getByTestId('hand-tool')).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await page.mouse.move(600, 300);
  await page.mouse.down();
  await page.mouse.move(500, 300, { steps: 3 });
  await page.mouse.up();

  expect((await camera(page)).x).toBeCloseTo(100, 0);
  await expect(page.getByTestId('zoom-percentage')).toHaveText('100%');
});

test('the wheel zooms about the pointer, keeping the board point under it', async ({
  page,
}) => {
  await open(page);

  const pointer = { x: 640, y: 360 };
  await page.mouse.move(pointer.x, pointer.y);
  const before = await camera(page);
  const held = under(before, pointer.x, pointer.y);

  await page.mouse.wheel(0, -100);

  const after = await camera(page);

  expect(after.zoom).toBeCloseTo(1.2, 3);
  expect(under(after, pointer.x, pointer.y).x).toBeCloseTo(held.x, 1);
  expect(under(after, pointer.x, pointer.y).y).toBeCloseTo(held.y, 1);
  await expect(page.getByTestId('zoom-percentage')).toHaveText('120%');

  await page.mouse.wheel(0, 100);

  expect((await camera(page)).zoom).toBeCloseTo(1, 3);
});

test('the keyboard zooms about the pointer too', async ({ page }) => {
  await open(page);

  const pointer = { x: 320, y: 180 };
  await page.mouse.move(pointer.x, pointer.y);
  const held = under(await camera(page), pointer.x, pointer.y);

  await page.keyboard.press('=');

  const zoomed = await camera(page);

  expect(zoomed.zoom).toBeCloseTo(1.2, 3);
  expect(under(zoomed, pointer.x, pointer.y).x).toBeCloseTo(held.x, 1);

  await page.keyboard.press('-');

  expect((await camera(page)).zoom).toBeCloseTo(1, 3);
});

test('the shortcut reference lists the keys that pan and zoom', async ({
  page,
}) => {
  await open(page);

  await page.keyboard.press('?');

  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();

  const rows = dialog.locator('li');

  await expect(rows.filter({ hasText: 'Pan' })).toContainText('SPACE');
  await expect(rows.filter({ hasText: 'Zoom in' })).toContainText('=');
  await expect(rows.filter({ hasText: 'Zoom out' })).toContainText('-');
});

test('fit brings the whole board into the view, centred', async ({ page }) => {
  await open(page);

  await page.mouse.move(600, 300);
  await page.mouse.wheel(0, 200);
  await page.mouse.wheel(0, 200);

  await page.getByTestId('fit').click();

  const view = await camera(page);
  const box = await viewport(page);
  const left = starter.x * view.zoom + view.x;
  const right = (starter.x + starter.w) * view.zoom + view.x;
  const top = starter.y * view.zoom + view.y;
  const bottom = (starter.y + starter.h) * view.zoom + view.y;

  expect(left).toBeGreaterThanOrEqual(30);
  expect(top).toBeGreaterThanOrEqual(30);
  expect(right).toBeLessThanOrEqual(box.width - 30);
  expect(bottom).toBeLessThanOrEqual(box.height - 30);
  expect((left + right) / 2).toBeCloseTo(box.width / 2, 1);
  expect((top + bottom) / 2).toBeCloseTo(box.height / 2, 1);
});

test('reset comes back to one hundred percent', async ({ page }) => {
  await open(page);

  await page.mouse.move(600, 300);
  await page.mouse.wheel(0, -200);
  await page.getByTestId('reset').click();

  await expect(page.getByTestId('zoom-percentage')).toHaveText('100%');
  expect((await camera(page)).zoom).toBe(1);
});

test('the grid thins its detail as the view zooms out, never crowding', async ({
  page,
}) => {
  await open(page);

  const close = await camera(page);
  const closeSpacing = await gridStep(page);
  const closeDetail = closeSpacing / close.zoom;

  await page.mouse.move(600, 300);
  await page.mouse.wheel(0, 200);
  await page.mouse.wheel(0, 200);

  const far = await camera(page);
  const farSpacing = await gridStep(page);

  expect(farSpacing / far.zoom).toBeGreaterThan(closeDetail);
  expect(farSpacing).toBeGreaterThanOrEqual(16);
});

test('a pan and a zoom together leave the board exactly as it was', async ({
  page,
}) => {
  await open(page);

  const before = await painted(page);

  await page.mouse.move(500, 400);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(640, 260, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
  await page.mouse.wheel(0, -240);
  await page.mouse.wheel(0, 120);

  expect(await painted(page)).toEqual(before);
});
