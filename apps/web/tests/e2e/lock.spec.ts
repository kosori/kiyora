import { openStarterBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

const TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;

/** The board is server-rendered; every test opens once the surface can act. */
const open = async (page: Page): Promise<void> => {
  await openStarterBoard(page);
};

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

const lockToggle = (page: Page) => page.getByTestId('lock-toggle');

const selectStarter = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 150, box.y + 150);
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

const dragHandle = async (
  page: Page,
  testId: string,
  dx: number,
  dy: number
) => {
  const box = await page.getByTestId(testId).boundingBox();

  if (box === null) {
    throw new Error(`${testId} has no box`);
  }
  await drag(
    page,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy }
  );
};

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

/** The page position of a board point, through the camera and the canvas box. */
const onScreen = async (
  page: Page,
  point: { x: number; y: number }
): Promise<{ x: number; y: number }> => {
  const box = await canvasBox(page);
  const view = await camera(page);

  return {
    x: point.x * view.zoom + view.x + box.x,
    y: point.y * view.zoom + view.y + box.y,
  };
};

/** Alt-click reaches under the lock, because a plain click cannot. */
const altClick = async (
  page: Page,
  point: { x: number; y: number }
): Promise<void> => {
  const where = await onScreen(page, point);

  await page.keyboard.down('Alt');
  await page.mouse.click(where.x, where.y);
  await page.keyboard.up('Alt');
};

const lockStarter = async (page: Page): Promise<void> => {
  await selectStarter(page);
  await expect(lockToggle(page)).toHaveText('Lock');
  await lockToggle(page).click();
  await expect(lockToggle(page)).toHaveText('Unlock');
};

test('locking the selection is one history entry, so one undo takes it back', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);

  await lockToggle(page).click();

  await expect(lockToggle(page)).toHaveText('Unlock');
  await expect(page.getByTestId('undo')).toBeEnabled();

  await page.getByTestId('undo').click();

  await expect(lockToggle(page)).toHaveText('Lock');
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('a locked shape resists nudge, resize, rotate and restyle', async ({
  page,
}) => {
  await open(page);
  await lockStarter(page);
  const before = await starterShape(page).getAttribute('d');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');

  expect(await starterShape(page).getAttribute('d')).toBe(before);

  await dragHandle(page, 'handle-se', 80, 80);
  expect(await starterShape(page).getAttribute('d')).toBe(before);

  await dragHandle(page, 'handle-rotate', 120, 120);
  expect(await starterShape(page).getAttribute('d')).toBe(before);

  await page.getByTestId('fill-blue').click();
  await expect(starterShape(page)).toHaveAttribute('fill', '#2f9e44');
});

test('a locked shape is not picked by click or marquee, and alt reaches it to unlock', async ({
  page,
}) => {
  await open(page);
  await lockStarter(page);
  const box = await canvasBox(page);

  await page.mouse.click(box.x + 560, box.y + 400);
  await expect(page.getByTestId('selection-frame')).toBeHidden();
  await expect(page.getByTestId('locked-hint')).toBeVisible();

  await page.mouse.click(box.x + 150, box.y + 150);
  await expect(page.getByTestId('selection-frame')).toBeHidden();

  await drag(
    page,
    { x: box.x + 20, y: box.y + 20 },
    { x: box.x + 400, y: box.y + 300 }
  );
  await expect(page.getByTestId('selection-frame')).toBeHidden();

  await altClick(page, { x: 150, y: 150 });

  await expect(page.getByTestId('selection-frame')).toBeVisible();
  await expect(lockToggle(page)).toHaveText('Unlock');

  await lockToggle(page).click();
  await expect(lockToggle(page)).toHaveText('Lock');

  await page.getByTestId('fill-blue').click();
  await expect(starterShape(page)).toHaveAttribute('fill', '#1971c2');
});

test('the lock survives a reload, and alt-click reaches it to unlock', async ({
  page,
}) => {
  await open(page);
  await lockStarter(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect(page.getByTestId('locked-hint')).toBeVisible();

  await altClick(page, { x: 150, y: 150 });
  await expect(lockToggle(page)).toHaveText('Unlock');

  await lockToggle(page).click();
  await expect(lockToggle(page)).toHaveText('Lock');

  await page.getByTestId('undo').click();
  await expect(lockToggle(page)).toHaveText('Unlock');
});
