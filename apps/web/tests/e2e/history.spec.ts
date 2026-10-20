import { expect, type Page, test } from '@playwright/test';

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

/** The starter board's rectangle, which paints first. */
const starterShape = (page: Page) =>
  page.getByTestId('board').locator('path').first();

const TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;

/** The camera the board is actually painted under. */
const camera = async (page: Page) => {
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

const ORIGINAL = 'M 80 80 L 300 80 L 300 220 L 80 220 Z';
const MOVED = 'M 120 120 L 340 120 L 340 260 L 120 260 Z';

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

test('a drag turns undo on, from the commit notification, and undo puts the shape back', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const undo = page.getByTestId('undo');
  const redo = page.getByTestId('redo');

  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  await drag(
    page,
    { x: box.x + 150, y: box.y + 150 },
    { x: box.x + 190, y: box.y + 190 }
  );

  await expect(starterShape(page)).toHaveAttribute('d', MOVED);
  await expect(undo).toBeEnabled();

  await undo.click();

  await expect(starterShape(page)).toHaveAttribute('d', ORIGINAL);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
});

test('Escape during a drag leaves nothing to undo', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.move(box.x + 150, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 230, box.y + 150, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();

  await expect(starterShape(page)).toHaveAttribute('d', ORIGINAL);
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('a pan is never undoable', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 500, box.y + 340, { steps: 4 });
  await page.mouse.up({ button: 'middle' });

  await expect(page.getByTestId('undo')).toBeDisabled();
  await expect(starterShape(page)).toHaveAttribute('d', ORIGINAL);
});

test('undo never puts the camera back, so a pan stays where the person left it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await drag(
    page,
    { x: box.x + 150, y: box.y + 150 },
    { x: box.x + 190, y: box.y + 190 }
  );
  await expect(page.getByTestId('undo')).toBeEnabled();

  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 460, box.y + 340, { steps: 4 });
  await page.mouse.up({ button: 'middle' });

  const panned = await camera(page);
  expect(panned.x).toBeCloseTo(60, 0);
  expect(panned.y).toBeCloseTo(40, 0);

  await page.getByTestId('undo').click();

  await expect(starterShape(page)).toHaveAttribute('d', ORIGINAL);
  expect(await camera(page)).toEqual(panned);
});

test('undo and redo work from the keyboard', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await drag(
    page,
    { x: box.x + 150, y: box.y + 150 },
    { x: box.x + 190, y: box.y + 190 }
  );
  await expect(starterShape(page)).toHaveAttribute('d', MOVED);

  await page.keyboard.press('Control+z');
  await expect(starterShape(page)).toHaveAttribute('d', ORIGINAL);
  await expect(page.getByTestId('undo')).toBeDisabled();

  await page.keyboard.press('Control+Shift+z');
  await expect(starterShape(page)).toHaveAttribute('d', MOVED);
});
