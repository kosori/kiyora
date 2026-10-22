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

/** The canvas's place on the screen, so board coordinates can be clicked exactly. */
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

const secondShape = (page: Page) =>
  page.getByTestId('board').locator('path').nth(1);

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

/**
 * Sets a range control the way a drag would. The value is written through the
 * prototype setter so React's own value tracker sees the change and fires.
 */
const setRange = async (
  page: Page,
  testId: string,
  value: number
): Promise<void> => {
  await page.getByTestId(testId).evaluate((element, next) => {
    const range = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(range, String(next));
    range.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
};

test('the inspector is a persistent panel, and explains an empty selection', async ({
  page,
}) => {
  await open(page);

  const inspector = page.getByTestId('inspector');

  await expect(inspector).toBeVisible();
  await expect(page.getByTestId('inspector-empty')).toContainText(
    /select a shape/i
  );
});

test('selecting a shape replaces the empty state with the controls', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);

  await expect(page.getByTestId('inspector-empty')).toBeHidden();
  await expect(page.getByTestId('fill-blue')).toBeVisible();
  await expect(page.getByTestId('fill-style-bold')).toBeVisible();
  await expect(page.getByTestId('stroke-ink')).toBeVisible();
  await expect(page.getByTestId('stroke-width')).toBeVisible();
  await expect(page.getByTestId('opacity')).toBeVisible();
  await expect(page.getByTestId('dash-dashed')).toBeVisible();
  await expect(page.getByTestId('corner-rounded')).toBeVisible();
});

test('picking a fill colour repaints the shape in that palette colour', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);

  await expect(starterShape(page)).toHaveAttribute('fill', '#2f9e44');

  await page.getByTestId('fill-blue').click();

  await expect(starterShape(page)).toHaveAttribute('fill', '#1971c2');
});

test('choosing a stroke colour repaints the outline, and ink stays on offer', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);

  await page.getByTestId('stroke-red').click();

  await expect(starterShape(page)).toHaveAttribute('stroke', '#e03131');

  await page.getByTestId('stroke-ink').click();

  await expect(starterShape(page)).toHaveAttribute('stroke', '#1e1e1e');
});

test('a typed colour snaps to the nearest palette hue', async ({ page }) => {
  await open(page);
  await selectStarter(page);

  await page.getByTestId('type-colour').fill('crimson');
  await page.getByTestId('type-colour').press('Enter');

  await expect(starterShape(page)).toHaveAttribute('fill', '#e03131');
});

test('a colour that reaches no hue is refused, not silently dropped', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);

  await page.getByTestId('type-colour').fill('nonsense');
  await page.getByTestId('type-colour').press('Enter');

  await expect(page.getByTestId('type-colour')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
  await expect(starterShape(page)).toHaveAttribute('fill', '#2f9e44');
});

test('fill style, stroke width, opacity, dash and corners all reach the paint', async ({
  page,
}) => {
  await open(page);
  await selectStarter(page);

  await page.getByTestId('fill-style-bold').click();
  await expect(starterShape(page)).toHaveAttribute('fill', '#2f9e44');

  await page.getByTestId('dash-dashed').click();
  await expect(starterShape(page)).toHaveAttribute('stroke-dasharray', '8 6');

  await page.getByTestId('corner-rounded').click();
  await expect(starterShape(page)).not.toHaveAttribute(
    'd',
    'M 80 80 L 300 80 L 300 220 L 80 220 Z'
  );

  await setRange(page, 'stroke-width', 8);
  await expect(starterShape(page)).toHaveAttribute('stroke-width', '8');

  await setRange(page, 'opacity', 50);
  await expect(starterShape(page)).toHaveAttribute(
    'fill',
    'rgba(47, 158, 68, 0.5)'
  );
});

test('a change reaches the whole selection, not just the shape under the pointer', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 400, y: box.y + 300 },
    { x: box.x + 520, y: box.y + 420 }
  );

  await drag(
    page,
    { x: box.x + 40, y: box.y + 40 },
    { x: box.x + 700, y: box.y + 500 }
  );

  await page.getByTestId('fill-red').click();

  await expect(starterShape(page)).toHaveAttribute('fill', '#e03131');
  await expect(secondShape(page)).toHaveAttribute(
    'fill',
    'rgba(224, 49, 49, 0.2)'
  );
});
