import { expect, type Page, test } from '@playwright/test';

/**
 * Reduced motion, proven at the browser seam. The preference is emulated on the
 * context, so the assertion is on what a person sees: a control that would
 * transition does not. The same control is read again with motion welcome, so a
 * green run cannot be a page that failed to style itself.
 */

/** Wait for the surface to say it can act, so the chrome is painted before it is read. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
};

/** How long the rail's buttons take to transition, in seconds, as painted. */
const transitionOf = (page: Page) =>
  page
    .getByRole('button', { name: 'Rectangle' })
    .evaluate((element) => getComputedStyle(element).transitionDuration);

test.describe('when the system asks for less motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the chrome does not transition', async ({ page }) => {
    await open(page);

    expect(Number.parseFloat(await transitionOf(page))).toBeLessThan(0.01);
  });
});

test.describe('when motion is welcome', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the chrome transitions', async ({ page }) => {
    await open(page);

    expect(Number.parseFloat(await transitionOf(page))).toBeGreaterThan(0);
  });
});
