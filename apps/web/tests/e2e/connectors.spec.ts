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

const connectorPaths = (page: Page) =>
  page.getByTestId('board').locator('path[data-shape="connector-1"]');

const routeOverlay = (page: Page) =>
  page
    .getByTestId('board')
    .locator('path[data-shape="connector-1"][data-wobble="true"]');

/** Which ink each connector path is, in paint order: the line, its ribbon, then a head. */
const inkOrder = (page: Page) =>
  connectorPaths(page).evaluateAll((paths) =>
    paths.map((path) =>
      path.getAttribute('data-wobble') === 'true'
        ? 'ribbon'
        : path.getAttribute('fill') === 'none'
          ? 'line'
          : 'head'
    )
  );

const connectorLine = (page: Page) => connectorPaths(page).first();

/** Draws the starter rectangle's partner at `at`, then joins the two. */
const joinTwoShapes = async (page: Page, box: { x: number; y: number }) => {
  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 500, y: box.y + 80 },
    { x: box.x + 600, y: box.y + 180 }
  );

  await page.keyboard.press('c');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 550, y: box.y + 130 }
  );
};

test('a drag joins two shapes with a connector that paints a real line', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await joinTwoShapes(page, box);

  await expect(connectorPaths(page)).toHaveCount(3);
  await expect(connectorLine(page)).toHaveAttribute('fill', 'none');
  await expect(connectorLine(page)).toHaveAttribute('stroke', '#1e1e1e');
  await expect(connectorLine(page)).toHaveAttribute('d', 'M 300 130 L 500 150');
});

test('a connector route carries the hand-drawn overlay, and the head paints above it', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await joinTwoShapes(page, box);

  await expect(routeOverlay(page)).toHaveCount(1);
  await expect(routeOverlay(page)).not.toHaveAttribute('fill', 'none');
  await expect(routeOverlay(page)).toHaveAttribute('fill', /.+/);
  expect(await inkOrder(page)).toEqual(['line', 'ribbon', 'head']);
});

test('moving a bound shape re-routes the connector, with no repair pass', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await joinTwoShapes(page, box);

  const before = await connectorLine(page).getAttribute('d');

  await page.mouse.click(box.x + 550, box.y + 130);
  await page.keyboard.press('ArrowRight');

  const after = await connectorLine(page).getAttribute('d');
  expect(after).not.toBe(before);
  expect(after).toBe('M 300 130 L 501 150');
});

test('a connector can be drawn before its target exists', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('c');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 600, y: box.y + 400 }
  );

  await expect(connectorPaths(page)).toHaveCount(3);
  await expect(connectorLine(page)).toHaveAttribute('fill', 'none');
  await expect(connectorLine(page)).not.toHaveAttribute('d', '');
});

test('the inspector chooses the route and a head per end, independently', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await joinTwoShapes(page, box);

  await page.mouse.click(box.x + 400, box.y + 140);

  const controls = page.getByTestId('connector-controls');
  await expect(controls).toBeVisible();

  await controls.getByTestId('route-elbow').click();
  await expect(connectorLine(page)).toHaveAttribute(
    'd',
    'M 300 130 L 400 130 L 400 150 L 500 150'
  );

  await controls.getByTestId('head-start-circle').click();

  await expect(connectorPaths(page)).toHaveCount(4);
});

test('a connector carries a label, typed on the canvas', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);
  await joinTwoShapes(page, box);

  await page.mouse.dblclick(box.x + 400, box.y + 140);

  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await page.keyboard.type('links');
  await editor.blur();

  await expect(
    page.getByTestId('board').locator('text', { hasText: 'links' })
  ).toBeVisible();
});

test('deleting a bound shape leaves its connector visible, not vanished', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('c');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 600, y: box.y + 400 }
  );

  await page.mouse.click(box.x + 150, box.y + 150);
  await expect(page.getByTestId('selection-frame')).toBeVisible();
  await page.keyboard.press('Delete');

  await expect(
    page.getByTestId('board').locator('path[data-shape="starter-rectangle"]')
  ).toHaveCount(0);
  await expect(connectorPaths(page)).toHaveCount(3);
  await expect(connectorLine(page)).toHaveAttribute('d', 'M 300 220 L 600 400');
});
