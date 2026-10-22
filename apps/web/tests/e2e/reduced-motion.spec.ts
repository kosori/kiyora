import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Reduced motion, proven at the browser seam. The preference is emulated on the
 * context, so every assertion is on what a person sees: a control that would
 * transition does not, and the board never transitions at all. Every animation
 * is read again with motion welcome, so a green run cannot be a page that
 * failed to style itself.
 *
 * The audit this file holds to: the chrome's buttons and the laser's fade are
 * the only animations the app has. The present timer ticks digits rather than
 * moving anything, and the palette and the context menu open with no animation
 * to suppress.
 */

/** Wait for the surface to say it can act, so the chrome is painted before it is read. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

/** A slide on the deck, playing, so the laser has a surface to paint on. */
const openPresent = async (page: Page): Promise<void> => {
  await open(page);
  await page.getByTestId('rail-tab-deck').click();
  await page.getByTestId('template-title').click();
  await page.getByTestId('present-button').click();
  await expect(page.getByTestId('present-overlay')).toBeVisible();
};

/** The three motion properties a computed style can answer, in seconds. */
type Motion = {
  animation: string;
  animationDuration: number;
  transitionDuration: number;
};

const motionOf = (target: Locator): Promise<Motion> =>
  target.evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      animation: style.animationName,
      animationDuration: Number.parseFloat(style.animationDuration),
      transitionDuration: Number.parseFloat(style.transitionDuration),
    };
  });

/** How long the rail's buttons take to transition, in seconds, as painted. */
const transitionOf = (page: Page) =>
  page
    .getByRole('button', { name: 'Rectangle' })
    .evaluate((element) => getComputedStyle(element).transitionDuration);

/** Presses on the slide so the laser paints, and returns its painted motion. */
const laserMotion = async (page: Page): Promise<Motion> => {
  const slide = await page.getByTestId('present-slide').boundingBox();

  if (slide === null) {
    throw new Error('the slide has no box');
  }

  await page.mouse.move(slide.x + slide.width / 2, slide.y + slide.height / 2);
  await page.mouse.down();
  const laser = page.getByTestId('present-laser');
  await expect(laser).toBeVisible();

  const motion = await motionOf(laser);
  await page.mouse.up();

  return motion;
};

test.describe('when the system asks for less motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the chrome does not transition', async ({ page }) => {
    await open(page);

    expect(Number.parseFloat(await transitionOf(page))).toBeLessThan(0.01);
  });

  test('the laser does not fade', async ({ page }) => {
    await openPresent(page);

    expect((await laserMotion(page)).transitionDuration).toBeLessThan(0.01);
  });

  test('nothing the palette or the menu opens with animates', async ({
    page,
  }) => {
    await open(page);
    const box = await page.getByTestId('canvas').boundingBox();
    if (box === null) {
      throw new Error('the canvas has no box');
    }

    await page.keyboard.press('Control+k');
    const palette = await motionOf(
      page.getByRole('dialog', { name: 'Command palette' })
    );
    await page.keyboard.press('Escape');

    await page.mouse.click(box.x + 150, box.y + 150, { button: 'right' });
    const menu = await motionOf(page.getByTestId('context-menu'));

    expect(palette.animation).toBe('none');
    expect(palette.transitionDuration).toBeLessThan(0.01);
    expect(menu.animation).toBe('none');
    expect(menu.transitionDuration).toBeLessThan(0.01);
  });
});

test.describe('when motion is welcome', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the chrome transitions', async ({ page }) => {
    await open(page);

    expect(Number.parseFloat(await transitionOf(page))).toBeGreaterThan(0);
  });

  test('the laser fades', async ({ page }) => {
    await openPresent(page);

    expect((await laserMotion(page)).transitionDuration).toBeGreaterThan(0);
  });

  test('the board never animates, whatever the system prefers', async ({
    page,
  }) => {
    await open(page);

    const board = await motionOf(page.getByTestId('board'));

    expect(board.animation).toBe('none');
    expect(board.animationDuration).toBe(0);
    expect(board.transitionDuration).toBe(0);
  });

  test('the palette and the menu open with no animation of their own', async ({
    page,
  }) => {
    await open(page);
    const box = await page.getByTestId('canvas').boundingBox();
    if (box === null) {
      throw new Error('the canvas has no box');
    }

    await page.keyboard.press('Control+k');
    const palette = await motionOf(
      page.getByRole('dialog', { name: 'Command palette' })
    );
    await page.keyboard.press('Escape');

    await page.mouse.click(box.x + 150, box.y + 150, { button: 'right' });
    const menu = await motionOf(page.getByTestId('context-menu'));

    expect(palette).toEqual({
      animation: 'none',
      animationDuration: 0,
      transitionDuration: 0,
    });
    expect(menu).toEqual({
      animation: 'none',
      animationDuration: 0,
      transitionDuration: 0,
    });
  });

  test('the present timer ticks digits, not motion', async ({ page }) => {
    await openPresent(page);

    const timer = page.getByTestId('present-timer');
    const first = await timer.textContent();
    const motion = await motionOf(timer);

    await expect
      .poll(async () => timer.textContent(), { timeout: 5000 })
      .not.toBe(first);
    expect(motion.animation).toBe('none');
    expect(motion.transitionDuration).toBe(0);
  });
});
