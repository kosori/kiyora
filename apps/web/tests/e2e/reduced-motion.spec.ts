import { expect, type Page, test } from '@playwright/test';

/**
 * Reduced motion, proven at the browser seam. The preference is emulated on the
 * context, so the assertion is on what a person sees: a control that would
 * transition does not, and the hand-drawn ribbon over a shape's clean geometry
 * is not drawn. The same board is drawn again with motion welcome, so a green
 * run cannot be a board that failed to paint at all.
 */

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
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

const board = (page: Page) => page.getByTestId('board');

/** How long the rail's buttons take to transition, in seconds, as painted. */
const transitionOf = (page: Page) =>
  page
    .getByRole('button', { name: 'Rectangle' })
    .evaluate((element) => getComputedStyle(element).transitionDuration);

/** Draw a rectangle so the board carries a shape with a hand-drawn overlay. */
const drawRectangle = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);
  await page.getByRole('button', { name: 'Rectangle' }).click();
  await page.mouse.move(box.x + 240, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 420, box.y + 320, { steps: 6 });
  await page.mouse.up();
};

test.describe('when the system asks for less motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the chrome does not transition', async ({ page }) => {
    await open(page);

    expect(Number.parseFloat(await transitionOf(page))).toBeLessThan(0.01);
  });

  test('the hand-drawn overlay is not drawn over the clean geometry', async ({
    page,
  }) => {
    await open(page);
    await drawRectangle(page);

    const overlay = board(page).locator('path[data-wobble="true"]');
    const clean = board(page).locator('path:not([data-wobble="true"])');

    await expect(overlay.first()).toBeHidden();
    await expect(clean.last()).toBeVisible();
  });
});

test.describe('when motion is welcome', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the chrome transitions and the hand-drawn overlay is drawn', async ({
    page,
  }) => {
    await open(page);

    expect(Number.parseFloat(await transitionOf(page))).toBeGreaterThan(0);

    await drawRectangle(page);

    const overlay = board(page).locator('path[data-wobble="true"]');
    await expect(overlay.first()).toBeVisible();
  });
});
