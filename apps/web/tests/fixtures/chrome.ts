import { expect, type Page } from '@playwright/test';

/**
 * Opens the floating board menu, where the title, file actions and appearance
 * settings now live, and waits for it to paint.
 */
export const openBoardMenu = async (page: Page): Promise<void> => {
  await page.getByTestId('menu').click();
  await expect(page.getByTestId('menu-panel')).toBeVisible();
};

/**
 * Opens the selection's floating style panel, where the fill, stroke, text and
 * opacity controls now live.
 */
export const openStylePanel = async (page: Page): Promise<void> => {
  await page.getByTestId('open-style').click();
  await expect(page.getByTestId('styles-panel')).toBeVisible();
};

/**
 * Opens the board menu when it is closed, then clicks one row in it. The menu
 * holds the file actions, so a spec asks for the row rather than reaching into
 * a chrome that may already be open.
 */
export const clickMenuItem = async (
  page: Page,
  testId: string
): Promise<void> => {
  if (!(await page.getByTestId('menu-panel').isVisible())) {
    await openBoardMenu(page);
  }
  await page.getByTestId(testId).click();
};
