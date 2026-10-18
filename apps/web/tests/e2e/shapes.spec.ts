import { expect, type Page, test } from '@playwright/test';

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
  page.getByTestId('canvas').locator('path').last();

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

/**
 * Waits until the client owns the page, and leaves the select tool active. The
 * window listener that runs the keymap arrives with hydration, so a press that
 * lands before it is simply lost: the press and its effect are retried together.
 */
const waitForClient = async (page: Page) => {
  await expect(async () => {
    await page.keyboard.press('r');
    await expect(railButton(page, 'Rectangle')).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 500 }
    );
  }).toPass({ timeout: 10_000 });

  await page.keyboard.press('v');
  await expect(railButton(page, 'Select')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
};

test('a key selects a tool, and the rail marks it', async ({ page }) => {
  await page.goto('/');
  await waitForClient(page);

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
  await page.goto('/');
  await waitForClient(page);

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
  await page.goto('/');
  const box = await canvasBox(page);
  await waitForClient(page);

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
  await page.goto('/');
  const box = await canvasBox(page);
  await waitForClient(page);

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
  await page.goto('/');
  const box = await canvasBox(page);
  await waitForClient(page);

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
  await page.goto('/');
  const box = await canvasBox(page);
  await waitForClient(page);

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
  await page.goto('/');
  await waitForClient(page);

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
