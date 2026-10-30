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

const railButton = (page: Page, label: string) =>
  page.getByRole('button', { name: label });

const board = (page: Page) => page.getByTestId('board');

const labels = (page: Page) => board(page).locator('text');

/** The painted baseline of every label line, in board units. */
const labelBaselines = (page: Page) =>
  labels(page).evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('y')))
  );

/** Place a text shape by clicking with the text tool, and wait for the overlay. */
const placeText = async (page: Page, box: { x: number; y: number }) => {
  await railButton(page, 'Text').click();
  await page.mouse.click(box.x + 300, box.y + 200);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  return editor;
};

test('a text shape lands on the canvas and paints visible words', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  const editor = await placeText(page, box);
  await editor.fill('Hello board');
  await editor.blur();

  const line = labels(page).first();
  await expect(line).toContainText('Hello board');
  await expect(line).toHaveAttribute('fill', '#1e1e1e');
  await expect(line).not.toHaveAttribute('fill', 'none');
});

test('double-clicking a shape edits its label on the canvas, not in a dialog', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await railButton(page, 'Rectangle').click();
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.up();

  await page.mouse.dblclick(box.x + 300, box.y + 225);

  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();

  await editor.fill('Plan');
  await editor.blur();

  await expect(labels(page).first()).toContainText('Plan');
  await expect(labels(page).first()).not.toHaveAttribute('fill', 'none');
});

test('bold, italic, inline code and links render as runs', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  const editor = await placeText(page, box);
  await editor.fill('**bold** *italic* `code` [link](https://example.com)');
  await editor.blur();

  await expect(board(page).locator('tspan[font-weight="bold"]')).toContainText(
    'bold'
  );
  await expect(board(page).locator('tspan[font-style="italic"]')).toContainText(
    'italic'
  );
  await expect(
    board(page).locator('tspan', { hasText: 'code' })
  ).toHaveAttribute('font-family', /Geist Mono/);
  await expect(
    board(page).locator('a[href="https://example.com"]')
  ).toContainText('link');
});

test('the editing overlay sets the words under the caret in the code face', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  const editor = await placeText(page, box);
  await editor.fill('plain `code` plain');
  await editor.blur();

  await page.mouse.dblclick(box.x + 300, box.y + 200);
  const again = page.getByTestId('text-editor');
  await expect(again).toBeVisible();

  await again.evaluate((element) => {
    const field = element as HTMLTextAreaElement;
    field.focus();
    const inside = field.value.indexOf('code') + 2;
    field.setSelectionRange(inside, inside);
    field.dispatchEvent(new Event('select', { bubbles: true }));
    field.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  });
  await expect(again).toHaveCSS('font-family', /Geist Mono/);

  await again.evaluate((element) => {
    const field = element as HTMLTextAreaElement;
    field.setSelectionRange(1, 1);
    field.dispatchEvent(new Event('select', { bubbles: true }));
    field.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  });
  await expect(again).toHaveCSS('font-family', /Balsamiq Sans Neue/);
});

test('a hostile link scheme never becomes a real link', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  const editor = await placeText(page, box);
  await editor.fill('[click me](javascript:alert(1))');
  await editor.blur();

  await expect(labels(page).first()).toContainText('click me');
  await expect(board(page).locator('a')).toBeHidden();
});

test('a long label wraps inside its shape', async ({ page }) => {
  await open(page);
  const box = await canvasBox(page);

  const editor = await placeText(page, box);
  await editor.fill('aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj');
  await editor.blur();

  await expect
    .poll(async () => {
      const baselines = await labelBaselines(page);
      return (
        baselines.length > 1 && new Set(baselines).size === baselines.length
      );
    })
    .toBe(true);

  const baselines = await labelBaselines(page);
  expect(baselines).toEqual([...baselines].sort((a, b) => a - b));
  expect(baselines[1] ?? 0).toBeGreaterThan(baselines[0] ?? 0);
});
