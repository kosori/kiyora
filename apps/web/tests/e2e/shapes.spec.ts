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

/** The topmost painted path: the shape a gesture just placed. */
const placedShape = (page: Page) =>
  page.getByTestId('board').locator('path').last();

const railButton = (page: Page, label: string) =>
  page.getByRole('button', { name: label });

const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
};

test('a key selects a tool, and the rail marks it', async ({ page }) => {
  await open(page);

  await page.keyboard.press('r');

  await expect(railButton(page, 'Rectangle')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.keyboard.press('v');

  await expect(railButton(page, 'Select')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('clicking the rail selects a tool', async ({ page }) => {
  await open(page);

  await railButton(page, 'Rectangle').click();

  await expect(railButton(page, 'Rectangle')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await railButton(page, 'Select').click();

  await expect(railButton(page, 'Select')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('a drag places a rectangle the size dragged, where the drag ended', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 400, y: box.y + 300 }
  );

  await expect(placedShape(page)).toHaveAttribute(
    'd',
    'M 200 150 L 400 150 L 400 300 L 200 300 Z'
  );
});

test('a click places a default-sized rectangle at the click', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await page.mouse.click(box.x + 400, box.y + 300);

  await expect(placedShape(page)).toHaveAttribute(
    'd',
    'M 320 250 L 480 250 L 480 350 L 320 350 Z'
  );
});

test('the tool returns to select after placing, so a second drag draws nothing', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 400, y: box.y + 300 }
  );

  const placed = await placedShape(page).getAttribute('d');

  await drag(
    page,
    { x: box.x + 600, y: box.y + 400 },
    { x: box.x + 700, y: box.y + 500 }
  );

  await expect(placedShape(page)).toHaveAttribute('d', placed ?? '');
});

test('the last used style applies to the next shape', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 100, y: box.y + 100 },
    { x: box.x + 200, y: box.y + 200 }
  );

  const first = placedShape(page);

  await expect(first).toHaveAttribute('fill', 'rgba(25, 113, 194, 0.2)');
  await expect(first).toHaveAttribute('stroke', '#1e1e1e');
  await expect(first).toHaveAttribute('stroke-width', '2');

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 300, y: box.y + 100 },
    { x: box.x + 400, y: box.y + 200 }
  );

  const second = placedShape(page);

  await expect(second).toHaveAttribute('fill', 'rgba(25, 113, 194, 0.2)');
  await expect(second).toHaveAttribute('stroke', '#1e1e1e');
  await expect(second).toHaveAttribute('stroke-width', '2');
});

test('the shortcut reference lists the keys that work', async ({ page }) => {
  await open(page);

  await page.keyboard.press('?');

  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();

  const rows = dialog.locator('li');
  await expect(rows.filter({ hasText: 'Select' })).toContainText('V');
  await expect(rows.filter({ hasText: 'Rectangle' })).toContainText('R');
  await expect(rows.filter({ hasText: 'Keyboard shortcuts' })).toContainText(
    '?'
  );
});

test('a drag lands on the board behind the camera, not on the canvas', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.move(box.x + 600, box.y + 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 700, box.y + 350, { steps: 5 });
  await page.mouse.up({ button: 'middle' });

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 400, y: box.y + 300 }
  );

  await expect(placedShape(page)).toHaveAttribute(
    'd',
    'M 100 100 L 300 100 L 300 250 L 100 250 Z'
  );
});

test('the picker reaches the whole vocabulary without lengthening the rail', async ({
  page,
}) => {
  await open(page);

  await expect(railButton(page, 'Star')).toHaveCount(0);

  await page.getByTestId('shape-picker').click();

  const menu = page.getByTestId('shape-picker-menu');
  await expect(menu).toBeVisible();

  const names = [
    'Star',
    'Cloud',
    'Cylinder',
    'Actor',
    'Brace',
    'Predefined Process',
  ];

  await Promise.all(
    names.map((name) =>
      expect(menu.getByRole('menuitem', { name })).toBeVisible()
    )
  );
});

test('choosing a kind from the picker places it, painted', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  await page.getByTestId('shape-picker').click();
  await page
    .getByTestId('shape-picker-menu')
    .getByRole('menuitem', { name: 'Star' })
    .click();

  await drag(
    page,
    { x: box.x + 200, y: box.y + 150 },
    { x: box.x + 400, y: box.y + 300 }
  );

  const placed = placedShape(page);

  await expect(placed).toHaveAttribute('fill', 'rgba(25, 113, 194, 0.2)');
  await expect(placed).toHaveAttribute('stroke', '#1e1e1e');
  await expect(placed).not.toHaveAttribute(
    'd',
    'M 200 150 L 400 150 L 400 300 L 200 300 Z'
  );
});

test('placing from the picker behaves identically to placing from the rail', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const from = { x: box.x + 200, y: box.y + 150 };
  const to = { x: box.x + 400, y: box.y + 300 };

  await railButton(page, 'Rectangle').click();
  await drag(page, from, to);

  const viaRail = placedShape(page);
  const railD = await viaRail.getAttribute('d');

  await page.getByTestId('shape-picker').click();
  await page
    .getByTestId('shape-picker-menu')
    .getByRole('menuitem', { name: 'Rectangle' })
    .click();
  await drag(page, from, to);

  await expect(placedShape(page)).toHaveAttribute('d', railD ?? '');
  await expect(placedShape(page)).toHaveAttribute(
    'fill',
    'rgba(25, 113, 194, 0.2)'
  );
});
