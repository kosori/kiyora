import { expect, type Page, test } from '@playwright/test';

const TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;

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

/** The canvas's place on the screen, so board coordinates can be dragged to exactly. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

/** The starter board's rectangle, which paints first. */
const starterShape = (page: Page) =>
  page.getByTestId('board').locator('path').first();

const frame = (page: Page) => page.getByTestId('selection-frame');

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

type Camera = { x: number; y: number; zoom: number };

/** The camera the board is placed by, read from its transform. */
const camera = async (page: Page): Promise<Camera> => {
  const value = await page.getByTestId('board').getAttribute('transform');
  const match = TRANSFORM.exec(value ?? '');

  if (match === null) {
    throw new Error(`the board is not placed by a camera: ${value}`);
  }

  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
};

/** Where a board point lands on the page, through the camera and the canvas box. */
const onScreen = (
  view: Camera,
  box: { x: number; y: number },
  point: { x: number; y: number }
) => ({
  x: point.x * view.zoom + view.x + box.x,
  y: point.y * view.zoom + view.y + box.y,
});

test('a click selects the shape it lands on, and the frame hugs it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await expect(frame(page)).toHaveAttribute('x', '80');
  await expect(frame(page)).toHaveAttribute('y', '80');
  await expect(frame(page)).toHaveAttribute('width', '220');
  await expect(frame(page)).toHaveAttribute('height', '140');
});

test('a click on empty canvas clears the selection', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await expect(frame(page)).toBeVisible();

  await page.mouse.click(box.x + 700, box.y + 500);
  await expect(frame(page)).toHaveCount(0);
});

test('shift-click adds a second shape to the selection', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 500, y: box.y + 80 },
    { x: box.x + 600, y: box.y + 180 }
  );

  await page.mouse.click(box.x + 150, box.y + 150);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + 550, box.y + 130);
  await page.keyboard.up('Shift');

  await expect(frame(page)).toHaveAttribute('x', '80');
  await expect(frame(page)).toHaveAttribute('width', '520');
  await expect(frame(page)).toHaveAttribute('height', '140');
});

test('a marquee drags on empty canvas and selects what it covers', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await drag(
    page,
    { x: box.x + 700, y: box.y + 500 },
    { x: box.x + 40, y: box.y + 40 }
  );

  await expect(frame(page)).toHaveAttribute('x', '80');
  await expect(frame(page)).toHaveAttribute('width', '220');
});

test('a marquee is drawn while it is dragged', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.move(box.x + 700, box.y + 500);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300, { steps: 4 });

  await expect(page.getByTestId('marquee')).toHaveAttribute('x', '400');
  await expect(page.getByTestId('marquee')).toHaveAttribute('width', '300');

  await page.mouse.up();
  await expect(page.getByTestId('marquee')).toHaveCount(0);
});

test('a drag moves the whole selection, keeping relative positions', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 400, y: box.y + 80 },
    { x: box.x + 500, y: box.y + 180 }
  );

  await drag(
    page,
    { x: box.x + 700, y: box.y + 500 },
    { x: box.x + 40, y: box.y + 40 }
  );

  await drag(
    page,
    { x: box.x + 150, y: box.y + 150 },
    { x: box.x + 190, y: box.y + 190 }
  );

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 120 120 L 340 120 L 340 260 L 120 260 Z'
  );
  await expect(
    page.getByTestId('board').locator('path').nth(1)
  ).toHaveAttribute('d', 'M 440 120 L 540 120 L 540 220 L 440 220 Z');
});

test('a drag snaps to the eight-pixel grid', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await drag(
    page,
    { x: box.x + 150, y: box.y + 150 },
    { x: box.x + 155, y: box.y + 155 }
  );

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 88 88 L 308 88 L 308 228 L 88 228 Z'
  );
});

test('the alt key bypasses the snap for an off-grid placement', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await page.keyboard.down('Alt');
  await drag(
    page,
    { x: box.x + 150, y: box.y + 150 },
    { x: box.x + 155, y: box.y + 155 }
  );
  await page.keyboard.up('Alt');

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 85 85 L 305 85 L 305 225 L 85 225 Z'
  );
});

test('arrows nudge by a pixel and a grid step', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await page.keyboard.press('ArrowRight');
  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 81 80 L 301 80 L 301 220 L 81 220 Z'
  );

  await page.keyboard.press('Shift+ArrowDown');
  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 81 88 L 301 88 L 301 228 L 81 228 Z'
  );
});

test('Escape cancels a drag and restores the positions', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await page.mouse.move(box.x + 150, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 230, box.y + 150, { steps: 5 });

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 160 80 L 380 80 L 380 220 L 160 220 Z'
  );

  await page.keyboard.press('Escape');
  await page.mouse.up();

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 80 80 L 300 80 L 300 220 L 80 220 Z'
  );
});

test('a click lands where the shape appears, under a moved and zoomed camera', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.move(box.x + 190, box.y + 150);
  await page.mouse.wheel(0, -120);
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 500, box.y + 340, { steps: 4 });
  await page.mouse.up({ button: 'middle' });

  const view = await camera(page);
  const target = onScreen(view, box, { x: 150, y: 150 });

  await page.mouse.click(target.x, target.y);

  await expect(frame(page)).toHaveAttribute('x', '80');
  await expect(frame(page)).toHaveAttribute('y', '80');
  await expect(frame(page)).toHaveAttribute('width', '220');
  await expect(frame(page)).toHaveAttribute('height', '140');
});

test('selecting draws the eight handles and the rotate handle', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);

  await expect(page.getByTestId('handle-se')).toHaveAttribute('x', '296');
  await expect(page.getByTestId('handle-se')).toHaveAttribute('y', '216');
  await expect(page.getByTestId('handle-e')).toHaveAttribute('y', '146');
  await expect(page.getByTestId('handle-rotate')).toHaveAttribute('cx', '190');
  await expect(page.getByTestId('handle-rotate')).toHaveAttribute('cy', '58');
});

test('dragging a corner handle resizes the shape', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await drag(
    page,
    { x: box.x + 300, y: box.y + 220 },
    { x: box.x + 360, y: box.y + 304 }
  );

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 80 80 L 360 80 L 360 304 L 80 304 Z'
  );
});

test('dragging an edge handle moves only that edge', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await drag(
    page,
    { x: box.x + 300, y: box.y + 150 },
    { x: box.x + 360, y: box.y + 150 }
  );

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 80 80 L 360 80 L 360 220 L 80 220 Z'
  );
});

test('a corner drag cannot invert or vanish the shape', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await drag(
    page,
    { x: box.x + 300, y: box.y + 220 },
    { x: box.x + 84, y: box.y + 84 }
  );

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 80 80 L 88 80 L 88 88 L 80 88 Z'
  );
});

test('alt resizes the shape from its centre', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await page.keyboard.down('Alt');
  await drag(
    page,
    { x: box.x + 300, y: box.y + 220 },
    { x: box.x + 360, y: box.y + 216 }
  );
  await page.keyboard.up('Alt');

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 20 84 L 360 84 L 360 216 L 20 216 Z'
  );
});

test('shift preserves the shape ratio while resizing', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await page.keyboard.down('Shift');
  await drag(
    page,
    { x: box.x + 300, y: box.y + 220 },
    { x: box.x + 520, y: box.y + 360 }
  );
  await page.keyboard.up('Shift');

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 80 80 L 520 80 L 520 360 L 80 360 Z'
  );
});

test('dragging the rotate handle turns the shape', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await drag(
    page,
    { x: box.x + 190, y: box.y + 58 },
    { x: box.x + 290, y: box.y + 150 }
  );

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 260 40 L 260 260 L 120 260 L 120 40 Z'
  );
});

test('a rotation can be returned to zero', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 150, box.y + 150);
  await drag(
    page,
    { x: box.x + 190, y: box.y + 58 },
    { x: box.x + 290, y: box.y + 150 }
  );
  await drag(
    page,
    { x: box.x + 190, y: box.y + 18 },
    { x: box.x + 98, y: box.y + 150 }
  );

  await expect(starterShape(page)).toHaveAttribute(
    'd',
    'M 80 80 L 300 80 L 300 220 L 80 220 Z'
  );
});
