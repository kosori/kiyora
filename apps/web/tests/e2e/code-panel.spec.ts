import { expect, type Page, test } from '@playwright/test';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
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

const board = (page: Page) => page.getByTestId('board');

/** A shape's clean geometry, keyed by the id the store minted for it. */
const clean = (page: Page, id: string) =>
  board(page).locator(`path[data-shape="${id}"]`);

const frame = { h: 300, w: 400, x: 100, y: 100 };

/** The frame the source applies to, drawn clear of the starter board. */
const drawFrame = async (page: Page) => {
  const box = await canvasBox(page);
  await page.keyboard.press('f');
  await page.mouse.move(box.x + frame.x, box.y + frame.y);
  await page.mouse.down();
  await page.mouse.move(box.x + frame.x + frame.w, box.y + frame.y + frame.h);
  await page.mouse.up();
};

/** Selects the frame by clicking a corner no generated figure covers. */
const selectFrame = async (page: Page) => {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + frame.x + frame.w - 20, box.y + frame.y + 280);
};

const openCode = async (page: Page) => {
  await page.getByTestId('rail-tab-code').click();
};

const source = (page: Page) => page.getByTestId('code-source');

test('the rail is one tabbed column and the canvas keeps its width', async ({
  page,
}) => {
  await open(page);

  const rail = page.getByTestId('rail');
  const inspectorWidth = (await rail.boundingBox())?.width;
  const canvasWidth = (await canvasBox(page)).width;

  expect(inspectorWidth).toBe(256);

  await page.getByTestId('rail-tab-deck').click();
  expect((await rail.boundingBox())?.width).toBe(inspectorWidth);
  expect((await canvasBox(page)).width).toBe(canvasWidth);

  await openCode(page);
  expect((await rail.boundingBox())?.width).toBe(inspectorWidth);
  expect((await canvasBox(page)).width).toBe(canvasWidth);
  await expect(page.getByTestId('code')).toBeVisible();
});

test('a source applies to the selected frame as one undo, and survives a reload', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);

  // A frame nobody generated from opens an empty panel, not an error.
  await expect(source(page)).toHaveValue('');

  await source(page).fill('Box [rectangle]');
  await source(page).press('Control+Enter');

  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 124 124 L 284 124 L 284 224 L 124 224 Z'
  );
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'fill',
    'rgba(25, 113, 194, 0.2)'
  );

  // One undo takes the whole apply back; redo puts it back.
  await page.getByTestId('undo').click();
  await expect(clean(page, 'rectangle-1')).toHaveCount(0);
  await expect(clean(page, 'frame-1')).toHaveAttribute(
    'd',
    'M 100 100 L 500 100 L 500 400 L 100 400 Z'
  );

  await page.getByTestId('redo').click();
  await expect(clean(page, 'rectangle-1')).toHaveCount(1);

  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await selectFrame(page);
  await openCode(page);
  await expect(source(page)).toHaveValue('Box [rectangle]');
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 124 124 L 284 124 L 284 224 L 124 224 Z'
  );
});

test('the generated figure is a member of the frame, so moving the frame carries it', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);
  await source(page).fill('Box');
  await source(page).press('Control+Enter');

  const box = await canvasBox(page);
  await page.mouse.move(box.x + 450, box.y + 350);
  await page.mouse.down();
  await page.mouse.move(box.x + 490, box.y + 350, { steps: 6 });
  await page.mouse.up();

  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 168 128 L 328 128 L 328 228 L 168 228 Z'
  );
});

test('an unreadable source leaves the board intact and keeps its text', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);
  await source(page).fill('->');
  await source(page).press('Control+Enter');

  await expect(clean(page, 'rectangle-1')).toHaveCount(0);
  await expect(clean(page, 'frame-1')).toHaveCount(1);
  await expect(source(page)).toHaveValue('->');
});

test('diagnostics list in source order and clicking one moves the caret to its line', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);

  const text = 'Box [rectangle]\nNope [not-a-shape]\n->\nOther';
  await source(page).fill(text);

  const diagnostics = page.getByTestId('code-diagnostic');
  await expect(diagnostics).toHaveCount(2);

  const warning = diagnostics.nth(0);
  await expect(warning).toHaveAttribute('data-severity', 'warning');
  await expect(warning).toContainText('unknown attribute "not-a-shape"');
  await expect(warning).toContainText('Line 2');

  const error = diagnostics.nth(1);
  await expect(error).toHaveAttribute('data-severity', 'error');
  await expect(error).toContainText('edge needs both ends');
  await expect(error).toContainText('Line 3');

  await warning.click();
  await expect(source(page)).toBeFocused();
  await expect
    .poll(() =>
      source(page).evaluate((element) =>
        element instanceof HTMLTextAreaElement ? element.selectionStart : -1
      )
    )
    .toBe(text.indexOf('Nope'));

  // Inserting a line above shifts both diagnostics, because the list derives
  // from the text on screen rather than from the last apply.
  await source(page).fill(`// note\n${text}`);
  await expect(diagnostics).toHaveCount(2);
  await expect(diagnostics.nth(0)).toContainText('Line 3');
  await expect(diagnostics.nth(1)).toContainText('Line 4');
});

test('an error leaves the lines after it parsed and painted', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);

  await source(page).fill('->\nBox');
  await source(page).press('Control+Enter');

  await expect(page.getByTestId('code-diagnostic')).toContainText(
    'edge needs both ends'
  );
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 124 124 L 284 124 L 284 224 L 124 224 Z'
  );
});

test('an unsupported family is one diagnostic and the rest of the file still applies', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);

  await source(page).fill('wireframe\nBox [rectangle]');
  await source(page).press('Control+Enter');

  const diagnostics = page.getByTestId('code-diagnostic');
  await expect(diagnostics).toHaveCount(1);
  await expect(diagnostics.nth(0)).toHaveAttribute('data-severity', 'error');
  await expect(diagnostics.nth(0)).toContainText(
    'unsupported family "wireframe"'
  );
  await expect(diagnostics.nth(0)).toContainText('Line 1');
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 124 124 L 284 124 L 284 224 L 124 224 Z'
  );
});

test('Mod+Enter outside the panel applies nothing, as before', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);

  await page.keyboard.press('Control+Enter');

  await expect(page.getByTestId('undo')).toBeEnabled();
  await expect(clean(page, 'rectangle-1')).toHaveCount(0);
  await openCode(page);
  await expect(source(page)).toHaveValue('');
});
