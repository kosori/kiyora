import { expect, type Page, test } from '@playwright/test';

/**
 * The command palette's rows come from the same list the shortcut reference
 * reads, so these tests drive it like a person would: open it from the keys,
 * narrow it by typing, choose a row, and check that the board took the command
 * and that dismissing it leaves the keyboard where it was.
 */

/** The board is server-rendered, so its paint is on screen before React is listening. */
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

const palette = (page: Page) =>
  page.getByRole('dialog', { name: 'Command palette' });

const search = (page: Page) =>
  page.getByRole('combobox', { name: 'Search commands' });

const options = (page: Page) => palette(page).getByRole('option');

const shapes = (page: Page) =>
  page.getByTestId('board').locator('path[data-shape]');

/** The rail's Rectangle button, focused before the palette opens so focus return can be read. */
const rectangle = (page: Page) =>
  page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', {
    name: 'Rectangle',
  });

test('the palette opens on the command key, narrows as you type, and the chosen command changes the board', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 150, box.y + 150);
  await expect(page.getByTestId('selection-frame')).toBeVisible();

  await rectangle(page).focus();
  await page.keyboard.press('Control+k');

  await expect(palette(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');

  const all = await options(page).count();
  expect(all).toBeGreaterThan(10);

  await page.keyboard.press('ArrowDown');
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.type('del');
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toContainText('Delete');

  await page.keyboard.press('Enter');

  await expect(palette(page)).toBeHidden();
  await expect(shapes(page)).toHaveCount(0);
  await expect(rectangle(page)).toBeFocused();
});

test('escape dismisses the palette and leaves the keys where they were', async ({
  page,
}) => {
  await open(page);
  await rectangle(page).focus();
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(palette(page)).toBeHidden();
  await expect(rectangle(page)).toBeFocused();
});

test('a click outside dismisses the palette and leaves the keys where they were', async ({
  page,
}) => {
  await open(page);
  await rectangle(page).focus();
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();

  await page.mouse.click(4, 4);

  await expect(palette(page)).toBeHidden();
  await expect(rectangle(page)).toBeFocused();
});

test('a command that needs a selection runs and does nothing harmful without one', async ({
  page,
}) => {
  await open(page);

  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();
  await page.keyboard.type('delete');
  await expect(options(page)).toHaveCount(1);
  await page.keyboard.press('Enter');

  await expect(palette(page)).toBeHidden();
  await expect(shapes(page)).toHaveCount(1);
});

test('the command key does not open the palette while a label is being typed', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await page.mouse.dblclick(box.x + 150, box.y + 150);
  await expect(page.getByTestId('text-editor')).toBeFocused();

  await page.keyboard.press('Control+k');

  await expect(palette(page)).toBeHidden();
});

test('a command that needs chrome the palette does not own runs too, so the list is not half dead', async ({
  page,
}) => {
  await open(page);

  await page.keyboard.press('Control+k');
  await page.keyboard.type('keyboard');
  await expect(options(page)).toHaveCount(1);
  await page.keyboard.press('Enter');

  await expect(palette(page)).toBeHidden();
  await expect(
    page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  ).toBeVisible();
});

test('the palette names only rows the reference names', async ({ page }) => {
  await open(page);

  await page.keyboard.press('?');
  const reference = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(reference).toBeVisible();
  const labels = await reference
    .locator('li > span:first-child')
    .allTextContents();
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();
  const named = await options(page)
    .locator('[data-testid="palette-label"]')
    .allTextContents();

  expect(named.length).toBeGreaterThan(0);
  for (const label of named) {
    expect(labels).toContain(label);
  }
});
