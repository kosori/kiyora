import { openStarterBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await openStarterBoard(page);
};

/** The canvas's place on the screen, so board coordinates can be exact. */
const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const board = (page: Page) => page.getByTestId('board');

const railButton = (page: Page, label: string) =>
  page.getByRole('button', { name: label });

test('a drawn label is set in the hand-drawn face and painted, not left as no paint', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await railButton(page, 'Text').click();
  await page.mouse.click(box.x + 300, box.y + 200);

  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Hand drawn');
  await editor.blur();

  const run = board(page).locator('text tspan').first();
  await expect(run).toContainText('Hand drawn');

  const family = await run.evaluate(
    (node) => getComputedStyle(node).fontFamily
  );
  expect(family).toContain('Balsamiq Sans Neue');

  const line = board(page).locator('text').first();
  await expect(line).not.toHaveAttribute('fill', 'none');
  await expect(line).toHaveAttribute('fill', /.+/);
});
