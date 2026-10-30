import { expect, type Page, test } from '../fixtures/offline';

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

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

/** Every shape's painted path, in paint order. */
const shapePaths = (page: Page) => board(page).locator('path[data-shape]');

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

/** The starter's partner, drawn clear to the right and below it. */
const drawPartner = async (page: Page, box: { x: number; y: number }) =>
  drawRectangle(page, box, { h: 80, w: 100, x: 500, y: 300 });

const selectStarter = async (page: Page, box: { x: number; y: number }) => {
  await page.mouse.click(box.x + 150, box.y + 150);
};

const addToSelection = async (
  page: Page,
  box: { x: number; y: number },
  point: { x: number; y: number }
) => {
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + point.x, box.y + point.y);
  await page.keyboard.up('Shift');
};

/** The starter and its partner, selected, so align has two shapes to arrange. */
const selectPair = async (page: Page, box: { x: number; y: number }) => {
  await selectStarter(page, box);
  await addToSelection(page, box, { x: 550, y: 340 });
};

const ORIGINAL_STARTER = 'M 80 80 L 300 80 L 300 220 L 80 220 Z';
const ORIGINAL_PARTNER = 'M 500 300 L 600 300 L 600 380 L 500 380 Z';

test('align left and right put both shapes flush to the selection box', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await drawPartner(page, box);
  await selectPair(page, box);

  await page.getByTestId('align-left').click();

  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', ORIGINAL_STARTER);
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 80 300 L 180 300 L 180 380 L 80 380 Z'
  );

  await page.getByTestId('undo').click();
  await page.getByTestId('align-right').click();

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 380 80 L 600 80 L 600 220 L 380 220 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', ORIGINAL_PARTNER);
});

test('the centre alignments put both shapes on the selection box centre', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await drawPartner(page, box);
  await selectPair(page, box);

  await page.getByTestId('align-center-horizontal').click();

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 230 80 L 450 80 L 450 220 L 230 220 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 290 300 L 390 300 L 390 380 L 290 380 Z'
  );

  await page.getByTestId('undo').click();
  await page.getByTestId('align-center-vertical').click();

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 80 160 L 300 160 L 300 300 L 80 300 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 500 190 L 600 190 L 600 270 L 500 270 Z'
  );
});

test('align top and bottom put both shapes flush to a horizontal edge', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await drawPartner(page, box);
  await selectPair(page, box);

  await page.getByTestId('align-top').click();

  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 500 80 L 600 80 L 600 160 L 500 160 Z'
  );

  await page.getByTestId('undo').click();
  await page.getByTestId('align-bottom').click();

  await expect(shapePaths(page).nth(0)).toHaveAttribute(
    'd',
    'M 80 240 L 300 240 L 300 380 L 80 380 Z'
  );
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', ORIGINAL_PARTNER);
});

test('distribute spaces three shapes evenly on each axis', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);
  await drawPartner(page, box);
  await drawRectangle(page, box, { h: 60, w: 100, x: 700, y: 100 });

  await selectStarter(page, box);
  await addToSelection(page, box, { x: 550, y: 340 });
  await addToSelection(page, box, { x: 750, y: 130 });

  await page.getByTestId('distribute-x').click();

  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', ORIGINAL_STARTER);
  await expect(shapePaths(page).nth(1)).toHaveAttribute(
    'd',
    'M 450 300 L 550 300 L 550 380 L 450 380 Z'
  );
  await expect(shapePaths(page).nth(2)).toHaveAttribute(
    'd',
    'M 700 100 L 800 100 L 800 160 L 700 160 Z'
  );

  await page.getByTestId('undo').click();
  await page.getByTestId('distribute-y').click();

  await expect(shapePaths(page).nth(2)).toHaveAttribute(
    'd',
    'M 700 230 L 800 230 L 800 290 L 700 290 Z'
  );
});

test('align appears at two selected shapes and distribute at three', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await drawPartner(page, box);
  await drawRectangle(page, box, { h: 60, w: 100, x: 700, y: 100 });
  await selectPair(page, box);

  await expect(page.getByTestId('arrange-controls')).toBeVisible();
  await expect(page.getByTestId('align-left')).toBeVisible();
  await expect(page.getByTestId('distribute-x')).toBeHidden();

  await addToSelection(page, box, { x: 750, y: 130 });

  await expect(page.getByTestId('distribute-x')).toBeVisible();
  await expect(page.getByTestId('distribute-y')).toBeVisible();
});

test('an alignment is one history entry, so one undo puts both shapes back', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await drawPartner(page, box);
  await selectPair(page, box);

  await page.getByTestId('align-left').click();
  await page.getByTestId('undo').click();

  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', ORIGINAL_PARTNER);

  await page.getByTestId('undo').click();
  await expect(
    board(page).locator('path[data-shape="rectangle-1"]')
  ).toBeHidden();
});

test('an alignment that moves nothing never lands in undo', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 80, y: box.y + 300 },
    { x: box.x + 180, y: box.y + 380 }
  );
  const aligned = 'M 80 300 L 180 300 L 180 380 L 80 380 Z';
  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', aligned);

  await selectStarter(page, box);
  await addToSelection(page, box, { x: 130, y: 340 });
  await page.getByTestId('align-left').click();

  await expect(shapePaths(page).nth(1)).toHaveAttribute('d', aligned);
  await page.getByTestId('undo').click();

  await expect(
    board(page).locator('path[data-shape="rectangle-1"]')
  ).toBeHidden();
});

test('a connector between aligned shapes re-routes', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);
  await drawPartner(page, box);

  await page.keyboard.press('c');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 550, y: box.y + 340 }
  );

  const connector = board(page)
    .locator('path[data-shape="connector-1"]')
    .first();
  const before = await connector.getAttribute('d');

  await selectPair(page, box);
  await page.getByTestId('align-top').click();

  const after = await connector.getAttribute('d');

  expect(after).not.toBe(before);
  await expect(connector).toHaveAttribute('d', /L 500 \d+/);
});
