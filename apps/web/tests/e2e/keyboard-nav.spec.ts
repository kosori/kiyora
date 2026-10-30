import { expect, type Page, test } from '../fixtures/offline';

const TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;

/**
 * Canvas keyboard navigation: the board is one tab stop, Enter enters a mode
 * where the arrows step the selection by geometry, and Escape leaves. Every
 * assertion reads what is painted — the selection frame's box, the camera's
 * transform, the live region's words — never a count of elements.
 */

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

/** The camera the board is placed by, read from its transform. */
const camera = async (page: Page) => {
  const value = await page.getByTestId('board').getAttribute('transform');
  const match = TRANSFORM.exec(value ?? '');

  if (match === null) {
    throw new Error(`the board is not placed by a camera: ${value}`);
  }

  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
};

const frame = (page: Page) => page.getByTestId('selection-frame');

/** The selected box, as the frame paints it. */
const selectedBox = async (page: Page) => {
  const [x, y, w, h] = await Promise.all(
    ['x', 'y', 'width', 'height'].map((name) => frame(page).getAttribute(name))
  );

  if (x === null || y === null || w === null || h === null) {
    throw new Error('nothing is selected');
  }

  return {
    h: Number(h),
    w: Number(w),
    x: Number(x),
    y: Number(y),
  };
};

const announcer = (page: Page) => page.getByTestId('selection-announcer');

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

/** A rectangle drawn from `(x, y)` to `(x + w, y + h)` on the board. */
const drawRectangle = async (
  page: Page,
  box: { x: number; y: number },
  rectangle: { h: number; w: number; x: number; y: number }
) => {
  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + rectangle.x, y: box.y + rectangle.y },
    {
      x: box.x + rectangle.x + rectangle.w,
      y: box.y + rectangle.y + rectangle.h,
    }
  );
};

/** Select the starter rectangle, put focus on the canvas, and enter the mode. */
const enterNavigation = async (
  page: Page,
  box: { x: number; y: number }
): Promise<void> => {
  await page.mouse.click(box.x + 150, box.y + 150);
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Enter');
};

test('Enter gives the arrows shape navigation, and Escape gives them back to nudging', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  // The far shape is painted first, so a step right cannot be "the next one".
  await drawRectangle(page, box, { h: 100, w: 100, x: 700, y: 140 });
  await drawRectangle(page, box, { h: 100, w: 100, x: 400, y: 120 });

  await enterNavigation(page, box);
  await expect(page.getByTestId('canvas')).toBeFocused();
  await expect(announcer(page)).toHaveText('Rectangle selected, 1 of 3');

  await page.keyboard.press('ArrowRight');
  expect(await selectedBox(page)).toEqual({ h: 100, w: 100, x: 400, y: 120 });
  await expect(announcer(page)).toHaveText('Rectangle selected, 3 of 3');

  await page.keyboard.press('ArrowRight');
  expect(await selectedBox(page)).toEqual({ h: 100, w: 100, x: 700, y: 140 });

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('canvas')).toBeFocused();
  await page.keyboard.press('ArrowRight');

  expect(await selectedBox(page)).toEqual({ h: 100, w: 100, x: 701, y: 140 });
});

test('two equally near shapes resolve by paint order, so the step is repeatable', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  // Mirrored about the starter, so both are the same way off its line.
  await drawRectangle(page, box, { h: 80, w: 100, x: 500, y: 10 });
  await drawRectangle(page, box, { h: 80, w: 100, x: 500, y: 210 });

  await enterNavigation(page, box);
  await page.keyboard.press('ArrowRight');

  expect(await selectedBox(page)).toEqual({ h: 80, w: 100, x: 500, y: 10 });
});

test('nothing in that direction leaves the selection where it is, and wraps nowhere', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await enterNavigation(page, box);
  await page.keyboard.press('ArrowRight');

  expect(await selectedBox(page)).toEqual({ h: 140, w: 220, x: 80, y: 80 });
  await expect(announcer(page)).toHaveText('Rectangle selected, 1 of 1');

  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');

  expect(await selectedBox(page)).toEqual({ h: 140, w: 220, x: 81, y: 80 });
});

test('the camera follows a step off the edge by the least pan that shows it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  const target = { h: 100, w: 200, x: Math.round(box.width) - 260, y: 100 };
  await drawRectangle(page, box, target);
  await expect(
    page.getByTestId('board').locator('path[data-shape]').nth(1)
  ).toHaveAttribute(
    'd',
    `M ${target.x} ${target.y} L ${target.x + target.w} ${target.y} L ${target.x + target.w} ${target.y + target.h} L ${target.x} ${target.y + target.h} Z`
  );

  // Select the starter and push the target out of the view, so the follow is
  // the only thing that can bring it back.
  await page.mouse.click(box.x + 150, box.y + 150);
  await page.keyboard.down('Space');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 400 },
    { x: box.x + 800, y: box.y + 400 }
  );
  await page.keyboard.up('Space');

  const pushed = await camera(page);
  expect(pushed.x).toBeCloseTo(600, 0);
  expect(target.x + target.w + pushed.x).toBeGreaterThan(box.width);

  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');

  const view = await camera(page);
  expect(await selectedBox(page)).toEqual(target);
  expect(view.zoom).toBe(1);

  const left = target.x + view.x;
  const right = left + target.w;
  const top = target.y + view.y;

  expect(left).toBeGreaterThanOrEqual(0);
  expect(right).toBeLessThanOrEqual(box.width);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top + target.h).toBeLessThanOrEqual(box.height);

  // The least pan shows the whole shape with a margin, rather than centring
  // the board on it: the right edge lands on the margin, not in the middle.
  expect(right).toBeCloseTo(box.width - 48, 0);
  expect(right).toBeGreaterThan(box.width / 2);
});
