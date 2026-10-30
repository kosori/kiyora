import { openBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * Alignment guides (#58): a dragged edge lands on another shape's edge, a guide
 * is drawn while the drag is open, and the whole drag is still one undo. Two
 * rectangles on an off-grid edge, so a guide and the grid disagree: the guide
 * sits at 317, the grid would pull the edge to 320.
 */

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'green',
  fillStyle: 'bold',
  stroke: 'green',
  strokeWidth: 2,
} as const;

const board = () => ({
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  id: 'guides-board',
  schemaVersion: 1,
  settings: { theme: 'light' },
  shapes: [
    {
      h: 80,
      id: 'dragged',
      kind: 'rectangle',
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: STYLE,
      w: 120,
      x: 80,
      y: 80,
    },
    {
      h: 80,
      id: 'target',
      kind: 'rectangle',
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: STYLE,
      w: 120,
      x: 317,
      y: 280,
    },
  ],
  title: 'Guides',
  updatedAt: 1_700_000_000_000,
});

const open = async (page: Page): Promise<void> => {
  await openBoard(page, board(), { storage: 'local' });
};

const TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;

/** Where a board point lands on the page, through the camera and the canvas box. */
const place = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();
  const value = await page.getByTestId('board').getAttribute('transform');
  const match = TRANSFORM.exec(value ?? '');

  if (box === null || match === null) {
    throw new Error('the canvas or its camera has no box');
  }

  const [x, y, zoom] = [Number(match[1]), Number(match[2]), Number(match[3])];

  return (point: { x: number; y: number }) => ({
    x: point.x * zoom + x + box.x,
    y: point.y * zoom + y + box.y,
  });
};

const dragged = (page: Page) =>
  page.getByTestId('board').locator('path').first();

test('a dragged edge lands on another shape’s edge, with a guide while it is open', async ({
  page,
}) => {
  await open(page);
  const onScreen = await place(page);

  await page.mouse.move(
    onScreen({ x: 140, y: 120 }).x,
    onScreen({ x: 140, y: 120 }).y
  );
  await page.mouse.down();
  await page.mouse.move(
    onScreen({ x: 379, y: 120 }).x,
    onScreen({ x: 379, y: 120 }).y,
    { steps: 12 }
  );

  const guide = page.getByTestId('guide-x');
  await expect(guide).toHaveAttribute('x1', '317');
  await expect(guide).toHaveAttribute('x2', '317');

  await page.mouse.up();

  await expect(page.getByTestId('guide-x')).toBeHidden();
  await expect(dragged(page)).toHaveAttribute(
    'd',
    'M 317 80 L 437 80 L 437 160 L 317 160 Z'
  );

  await page.getByTestId('undo').click();

  await expect(dragged(page)).toHaveAttribute(
    'd',
    'M 80 80 L 200 80 L 200 160 L 80 160 Z'
  );
});

test('alt leaves the edge where the pointer put it, guide and grid bypassed', async ({
  page,
}) => {
  await open(page);
  const onScreen = await place(page);

  await page.keyboard.down('Alt');
  await page.mouse.move(
    onScreen({ x: 140, y: 120 }).x,
    onScreen({ x: 140, y: 120 }).y
  );
  await page.mouse.down();
  await page.mouse.move(
    onScreen({ x: 379, y: 120 }).x,
    onScreen({ x: 379, y: 120 }).y,
    { steps: 12 }
  );
  await expect(page.getByTestId('guide-x')).toBeHidden();

  await page.mouse.up();
  await page.keyboard.up('Alt');

  await expect(dragged(page)).toHaveAttribute(
    'd',
    'M 319 80 L 439 80 L 439 160 L 319 160 Z'
  );
});
