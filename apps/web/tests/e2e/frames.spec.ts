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

/** The canvas's place on the screen, so board coordinates can be dragged to exactly. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

/** The board's paint, in document order, so a test can name the path it means. */
const paths = (page: Page) => board(page).locator('path');

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

/** A point on the page, from a point on the board. */
const at = (
  box: { x: number; y: number },
  point: { x: number; y: number }
) => ({ x: box.x + point.x, y: box.y + point.y });

/** A frame drawn from `(x, y)` to `(x + w, y + h)` on the board. */
const drawFrame = async (
  page: Page,
  box: { x: number; y: number },
  frame: { h: number; w: number; x: number; y: number }
) => {
  await page.keyboard.press('f');
  await drag(
    page,
    at(box, { x: frame.x, y: frame.y }),
    at(box, { x: frame.x + frame.w, y: frame.y + frame.h })
  );
};

/** A rectangle drawn from `(x, y)` to `(x + w, y + h)` on the board. */
const drawRectangle = async (
  page: Page,
  box: { x: number; y: number },
  rectangle: { h: number; w: number; x: number; y: number }
) => {
  await page.keyboard.press('r');
  await drag(
    page,
    at(box, { x: rectangle.x, y: rectangle.y }),
    at(box, { x: rectangle.x + rectangle.w, y: rectangle.y + rectangle.h })
  );
};

type Rgba = { a: number; b: number; g: number; r: number };

/**
 * One canvas pixel at a board coordinate, read by rasterizing the live SVG the
 * way the exporter will. The point is mapped through the board group's own
 * transform, so the reading does not depend on where the shell has put the
 * canvas or what the camera is doing — only on the board coordinate asked for.
 * The grid and the selection furniture come off first, so the pixel is the
 * board's own paint rather than the editor's.
 */
const pixelAt = async (
  page: Page,
  point: { x: number; y: number }
): Promise<Rgba> =>
  page.evaluate(
    async ({ px, py }) => {
      const svg = document.querySelector('svg[data-testid="canvas"]');
      if (!(svg instanceof SVGSVGElement)) {
        throw new Error('the canvas is not an SVG');
      }
      const group = svg.querySelector('[data-testid="board"]');
      if (!(group instanceof SVGGElement)) {
        throw new Error('the board group is missing');
      }
      const matrix = group.getCTM();
      if (matrix === null) {
        throw new Error('the board has no transform');
      }
      const boardPoint = svg.createSVGPoint();
      boardPoint.x = px;
      boardPoint.y = py;
      const local = boardPoint.matrixTransform(matrix);
      const rect = svg.getBoundingClientRect();
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('height', String(rect.height));
      clone.setAttribute('width', String(rect.width));
      clone.querySelector('[data-testid="dot-grid"]')?.remove();
      clone.querySelector('[data-testid="selection-frame"]')?.remove();

      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        new XMLSerializer().serializeToString(clone)
      )}`;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.height = rect.height;
      canvas.width = rect.width;
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('no two-dimensional context');
      }
      context.drawImage(image, 0, 0);

      const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(
        Math.round(local.x),
        Math.round(local.y),
        1,
        1
      ).data;

      return { a, b, g, r };
    },
    { px: point.x, py: point.y }
  );

const frame = { h: 300, w: 400, x: 100, y: 100 };

test('the frame tool is on the rail and in the shortcut reference', async ({
  page,
}) => {
  await open(page);

  await page.keyboard.press('f');

  await expect(page.getByRole('button', { name: 'Frame' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.keyboard.press('?');

  const rows = page
    .getByRole('dialog', { name: 'Keyboard shortcuts' })
    .locator('li');

  await expect(rows.filter({ hasText: 'Frame' })).toContainText('F');
});

test('a frame holds a shape drawn inside it, and dragging the frame carries it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await drawFrame(page, box, frame);
  await drawRectangle(page, box, { h: 50, w: 100, x: 150, y: 150 });

  const framePath = paths(page).nth(1);
  const memberPath = paths(page).last();

  await expect(framePath).toHaveAttribute(
    'd',
    'M 100 100 L 500 100 L 500 400 L 100 400 Z'
  );
  await expect(memberPath).toHaveAttribute(
    'd',
    'M 150 150 L 250 150 L 250 200 L 150 200 Z'
  );

  await drag(page, at(box, { x: 450, y: 350 }), at(box, { x: 490, y: 390 }));

  await expect(framePath).toHaveAttribute(
    'd',
    'M 144 144 L 544 144 L 544 444 L 144 444 Z'
  );
  await expect(memberPath).toHaveAttribute(
    'd',
    'M 194 194 L 294 194 L 294 244 L 194 244 Z'
  );
});

test('a frame keeps the box it was authored with when a shape lands inside it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await drawFrame(page, box, frame);

  const framePath = paths(page).nth(1);
  await expect(framePath).toHaveAttribute(
    'd',
    'M 100 100 L 500 100 L 500 400 L 100 400 Z'
  );

  await drawRectangle(page, box, { h: 50, w: 100, x: 150, y: 150 });

  await expect(framePath).toHaveAttribute(
    'd',
    'M 100 100 L 500 100 L 500 400 L 100 400 Z'
  );
});

test('a frame clips a member to its own box', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await drawFrame(page, box, frame);
  await drawRectangle(page, box, { h: 50, w: 100, x: 150, y: 150 });

  await drag(page, at(box, { x: 200, y: 175 }), at(box, { x: 100, y: 175 }));

  const memberPath = paths(page).last();
  await expect(memberPath).toHaveAttribute(
    'd',
    'M 50 150 L 150 150 L 150 200 L 50 200 Z'
  );

  const clipped = await pixelAt(page, { x: 60, y: 175 });
  const kept = await pixelAt(page, { x: 120, y: 175 });

  expect(clipped.a).toBe(0);
  expect(kept.a).toBeGreaterThan(0);
});
