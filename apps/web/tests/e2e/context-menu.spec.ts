import { openStarterBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * The board is server-rendered, so its paint is on screen before React is
 * listening. Every test opens through this, which waits for the surface to say
 * it can act.
 */
const open = async (page: Page): Promise<void> => {
  await openStarterBoard(page);
};

/** The canvas's place on the screen, so board coordinates can be drawn at exactly. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

/** The starter board's rectangle: 80,80 at 220x140, painted first. */
const STARTER = 'M 80 80 L 300 80 L 300 220 L 80 220 Z';

/** The copy a paste puts a grid's three steps away. */
const PASTED = 'M 104 104 L 324 104 L 324 244 L 104 244 Z';

const menu = (page: Page) => page.getByTestId('context-menu');

const entry = (page: Page, name: string) =>
  menu(page).getByRole('menuitem', { exact: true, name });

const shapeWith = (page: Page, d: string) =>
  page.getByTestId('board').locator(`path[data-shape][d="${d}"]`);

/** Every shape's clean path, in paint order, so an order change is read from the paint. */
const shapePaths = (page: Page) =>
  page.getByTestId('board').locator('path[data-shape]');

/** Selects the starter by clicking inside it. */
const selectStarter = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 150, box.y + 150);
};

/** Right-clicks a board point, which is a canvas pixel while the camera is at rest. */
const rightClick = async (
  page: Page,
  point: { x: number; y: number }
): Promise<void> => {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + point.x, box.y + point.y, {
    button: 'right',
  });
};

/** Right-clicks the starter's middle. */
const rightClickStarter = async (page: Page): Promise<void> => {
  await rightClick(page, { x: 150, y: 150 });
};

/** The selection's own pixel box as the system clipboard holds it, or `null` before the copy lands. */
const clipboardPngSize = (page: Page) =>
  page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const png = items.find((item) => item.types.includes('image/png'));

    if (png === undefined) {
      return null;
    }
    const bitmap = await createImageBitmap(await png.getType('image/png'));

    return { height: bitmap.height, width: bitmap.width };
  });

test('right-click on the selection opens the menu at the pointer, and empty canvas opens nothing', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);
  const box = await canvasBox(page);

  await rightClick(page, { x: 180, y: 120 });

  await expect(menu(page)).toBeVisible();
  const placed = await menu(page).boundingBox();
  if (placed === null) {
    throw new Error('the menu has no box');
  }
  expect(Math.abs(placed.x - (box.x + 180))).toBeLessThan(16);
  expect(Math.abs(placed.y - (box.y + 120))).toBeLessThan(16);

  await page.keyboard.press('Escape');
  // A closed menu has no state to read beyond its absence from the
  // accessibility tree, so hidden is the honest assertion here.
  await expect(menu(page)).toBeHidden();

  await rightClick(page, { x: 600, y: 430 });
  await expect(menu(page)).toBeHidden();
});

test('an item runs the command the keyboard runs, and one undo takes it back', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);
  await rightClickStarter(page);

  await entry(page, 'Delete').click();

  await expect(menu(page)).toBeHidden();
  await expect(shapeWith(page, STARTER)).toBeHidden();

  await page.getByTestId('undo').click();

  await expect(shapeWith(page, STARTER)).toBeVisible();
});

test('items without a target are disabled rather than missing', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);
  await rightClickStarter(page);

  await Promise.all(
    ['Group', 'Ungroup', 'Align left', 'Paste'].map((name) =>
      expect(entry(page, name)).toBeDisabled()
    )
  );
  await expect(entry(page, 'Delete')).toBeEnabled();

  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+c');
  await rightClickStarter(page);

  await expect(entry(page, 'Paste')).toBeEnabled();
});

test('a locked shape offers unlock and no arrangement that would move it', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);
  await page.getByTestId('lock-toggle').click();
  await expect(page.getByTestId('lock-toggle')).toHaveText('Unlock');

  await rightClickStarter(page);

  await expect(entry(page, 'Unlock')).toBeEnabled();
  await expect(entry(page, 'Align left')).toBeDisabled();
  await expect(entry(page, 'Align bottom')).toBeDisabled();

  await entry(page, 'Unlock').click();

  await expect(page.getByTestId('lock-toggle')).toHaveText('Lock');
});

test('Escape and an outside click dismiss it, and focus returns', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);
  await rightClickStarter(page);

  await expect(page.getByTestId('context-menu-cut')).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(menu(page)).toBeHidden();
  expect(
    await page.evaluate(() => document.activeElement === document.body)
  ).toBe(true);

  await page.keyboard.press('r');
  await expect(page.getByRole('button', { name: 'Rectangle' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.keyboard.press('v');
  await selectStarter(page);
  await rightClickStarter(page);
  await expect(menu(page)).toBeVisible();

  const box = await canvasBox(page);
  await page.mouse.click(box.x + 600, box.y + 430);

  await expect(menu(page)).toBeHidden();
});

test('the keyboard moves through the menu and Enter runs the focused item', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);
  await rightClickStarter(page);

  await expect(page.getByTestId('context-menu-cut')).toBeFocused();
  await page.keyboard.press('ArrowDown');

  await expect(page.getByTestId('context-menu-copy')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(menu(page)).toBeHidden();

  await rightClickStarter(page);
  await entry(page, 'Paste').click();

  await expect(shapeWith(page, PASTED)).toBeVisible();
});

test('a right-click starts no marquee, no move and no placement', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);
  const box = await canvasBox(page);
  const before = await shapeWith(page, STARTER).getAttribute('d');

  await page.mouse.move(box.x + 150, box.y + 150);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + 250, box.y + 250);
  await page.mouse.up({ button: 'right' });

  await expect(shapeWith(page, STARTER)).toHaveAttribute('d', before ?? '');
  await expect(page.getByTestId('marquee')).toBeHidden();

  await page.keyboard.press('Escape');
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + 600, box.y + 430);
  await page.mouse.up({ button: 'right' });

  await expect(
    shapeWith(page, 'M 400 300 L 600 300 L 600 430 L 400 430 Z')
  ).toBeHidden();
  await expect(page.getByTestId('marquee')).toBeHidden();
});

test('copy as PNG runs from the menu and puts the selection on the clipboard', async ({
  context,
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'the clipboard is proven in Chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await selectStarter(page);
  await rightClickStarter(page);

  await entry(page, 'Copy as PNG').click();

  await expect
    .poll(() => clipboardPngSize(page))
    .toEqual({
      height: 140,
      width: 220,
    });
});

test('a refused PNG copy names why in the chrome rather than dropping the rejection', async ({
  context,
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'the clipboard is proven in Chromium');
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: () => Promise.reject(new Error('denied')),
      },
    });
  });
  await open(page);
  await selectStarter(page);
  await rightClickStarter(page);

  await entry(page, 'Copy as PNG').click();

  await expect(page.getByTestId('file-error')).toContainText(
    'the browser refused the clipboard'
  );
});

test('the menu is display state, so opening it leaves no history entry behind', async ({
  page,
}) => {
  await open(page);

  await rightClickStarter(page);
  await expect(menu(page)).toBeVisible();
  await expect(menu(page)).toContainText('Cut');

  await page.keyboard.press('Escape');

  await expect(page.getByTestId('undo')).toBeDisabled();
  await expect(shapeWith(page, STARTER)).toBeVisible();
});

test('near the bottom edge the menu opens upward and its last entry still runs', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const top = box.height - 160;
  const drawn = `M 320 ${top} L 480 ${top} L 480 ${top + 120} L 320 ${top + 120} Z`;

  await page.keyboard.press('r');
  await page.mouse.move(box.x + 320, box.y + top);
  await page.mouse.down();
  await page.mouse.move(box.x + 480, box.y + top + 120);
  await page.mouse.up();
  await page.keyboard.press('v');

  const pointer = { x: 400, y: top + 100 };
  await rightClick(page, pointer);
  await expect(menu(page)).toBeVisible();

  const placed = await menu(page).boundingBox();
  if (placed === null) {
    throw new Error('the menu has no box');
  }
  expect(placed.y).toBeGreaterThanOrEqual(box.y);
  expect(placed.y + placed.height).toBeLessThanOrEqual(box.y + pointer.y + 1);

  await page.keyboard.press('End');
  await expect(entry(page, 'Send to back')).toBeFocused();
  await expect(entry(page, 'Send to back')).toBeInViewport();

  await entry(page, 'Send to back').click();

  await expect(menu(page)).toBeHidden();
  await expect(shapePaths(page).nth(0)).toHaveAttribute('d', drawn);
});

test('near the right edge the menu slides left so it stays inside the canvas', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  const left = box.width - 320;
  const drawn = `M ${left} 120 L ${left + 260} 120 L ${left + 260} 260 L ${left} 260 Z`;

  await page.keyboard.press('r');
  await page.mouse.move(box.x + left, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + left + 260, box.y + 260);
  await page.mouse.up();
  await page.keyboard.press('v');

  await rightClick(page, { x: box.width - 70, y: 190 });
  await expect(menu(page)).toBeVisible();

  const placed = await menu(page).boundingBox();
  if (placed === null) {
    throw new Error('the menu has no box');
  }
  expect(placed.x).toBeGreaterThanOrEqual(box.x);
  expect(placed.x + placed.width).toBeLessThanOrEqual(box.x + box.width + 0.5);

  await entry(page, 'Delete').click();
  await expect(shapeWith(page, drawn)).toBeHidden();
});
