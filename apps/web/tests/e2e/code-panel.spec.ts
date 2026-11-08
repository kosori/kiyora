import { openStarterBoard } from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await openStarterBoard(page);
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

/** One drag on the canvas, in board pixels. */
const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 6 });
  await page.mouse.up();
};

const openCode = async (page: Page) => {
  await page.getByTestId('rail-tab-code').click();
};

const source = (page: Page) => page.getByTestId('code-source');

test('the rail opens one floating panel and the canvas keeps its width', async ({
  page,
}) => {
  await open(page);

  const rail = page.getByTestId('rail');
  const railWidth = (await rail.boundingBox())?.width;
  const canvasWidth = (await canvasBox(page)).width;

  expect(railWidth).toBe(40);

  await page.getByTestId('rail-tab-deck').click();
  await expect(page.getByTestId('rail-panel')).toBeVisible();
  expect((await rail.boundingBox())?.width).toBe(railWidth);
  expect((await canvasBox(page)).width).toBe(canvasWidth);

  await openCode(page);
  expect((await rail.boundingBox())?.width).toBe(railWidth);
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
    'M 136 124 L 272 124 C 278.627 124 284 129.373 284 136 L 284 212 C 284 218.627 278.627 224 272 224 L 136 224 C 129.373 224 124 218.627 124 212 L 124 136 C 124 129.373 129.373 124 136 124'
  );
  await expect(clean(page, 'rectangle-1')).toHaveAttribute('fill', 'none');

  // One undo takes the whole apply back; redo puts it back.
  await page.getByTestId('undo').click();
  await expect(clean(page, 'rectangle-1')).toBeHidden();
  await expect(clean(page, 'frame-1')).toHaveAttribute(
    'd',
    'M 100 100 L 500 100 L 500 400 L 100 400 Z'
  );

  await page.getByTestId('redo').click();
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 136 124 L 272 124 C 278.627 124 284 129.373 284 136 L 284 212 C 284 218.627 278.627 224 272 224 L 136 224 C 129.373 224 124 218.627 124 212 L 124 136 C 124 129.373 129.373 124 136 124'
  );

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
    'M 136 124 L 272 124 C 278.627 124 284 129.373 284 136 L 284 212 C 284 218.627 278.627 224 272 224 L 136 224 C 129.373 224 124 218.627 124 212 L 124 136 C 124 129.373 129.373 124 136 124'
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
    'M 180 128 L 316 128 C 322.627 128 328 133.373 328 140 L 328 216 C 328 222.627 322.627 228 316 228 L 180 228 C 173.373 228 168 222.627 168 216 L 168 140 C 168 133.373 173.373 128 180 128'
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

  await expect(clean(page, 'rectangle-1')).toBeHidden();
  await expect(clean(page, 'frame-1')).toHaveAttribute(
    'd',
    'M 100 100 L 500 100 L 500 400 L 100 400 Z'
  );
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
  await expect(diagnostics.nth(1)).toHaveAttribute('data-severity', 'error');
  await expect(diagnostics.nth(2)).toBeHidden();

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
  await expect(diagnostics.nth(0)).toContainText('Line 3');
  await expect(diagnostics.nth(1)).toContainText('Line 4');
  await expect(diagnostics.nth(2)).toBeHidden();
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
    'M 136 124 L 272 124 C 278.627 124 284 129.373 284 136 L 284 212 C 284 218.627 278.627 224 272 224 L 136 224 C 129.373 224 124 218.627 124 212 L 124 136 C 124 129.373 129.373 124 136 124'
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
  await expect(diagnostics.nth(0)).toHaveAttribute('data-severity', 'error');
  await expect(diagnostics.nth(0)).toContainText(
    'unsupported family "wireframe"'
  );
  await expect(diagnostics.nth(0)).toContainText('Line 1');
  await expect(diagnostics.nth(1)).toBeHidden();
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 136 124 L 272 124 C 278.627 124 284 129.373 284 136 L 284 212 C 284 218.627 278.627 224 272 224 L 136 224 C 129.373 224 124 218.627 124 212 L 124 136 C 124 129.373 129.373 124 136 124'
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
  await expect(clean(page, 'rectangle-1')).toBeHidden();
  await openCode(page);
  await expect(source(page)).toHaveValue('');
});

test('typing makes the source pending, and applying clears it', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);

  await source(page).fill('Box');
  await expect(page.getByTestId('code-pending')).toContainText('Pending');

  // Panning and selecting never touch a pending draft.
  await selectFrame(page);
  await page.keyboard.down('Space');
  await drag(page, { x: 40, y: 40 }, { x: 80, y: 60 });
  await page.keyboard.up('Space');
  await expect(page.getByTestId('code-pending')).toContainText('Pending');

  await source(page).press('Control+Enter');

  await expect(page.getByTestId('code-pending')).toBeHidden();
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 136 124 L 272 124 C 278.627 124 284 129.373 284 136 L 284 212 C 284 218.627 278.627 224 272 224 L 136 224 C 129.373 224 124 218.627 124 212 L 124 136 C 124 129.373 129.373 124 136 124'
  );
});

test('moving a generated shape makes the frame stale, and applying asks', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);
  await source(page).fill('Box');
  await source(page).press('Control+Enter');

  // A fresh frame applies silently.
  await expect(page.getByTestId('code-confirm')).toBeHidden();
  await expect(page.getByTestId('code-stale')).toBeHidden();

  // Drag the generated figure 20 units to the right. It lands on the starter
  // rectangle's edges, which the guides hold instead of the grid.
  await drag(page, { x: 180, y: 160 }, { x: 200, y: 160 });

  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 152 120 L 288 120 C 294.627 120 300 125.373 300 132 L 300 208 C 300 214.627 294.627 220 288 220 L 152 220 C 145.373 220 140 214.627 140 208 L 140 132 C 140 125.373 145.373 120 152 120'
  );

  // The panel follows the generated shape back to its frame.
  await expect(page.getByTestId('code-stale')).toContainText('Stale');

  // Selecting the frame and panning leave it where the hand edit put it.
  await selectFrame(page);
  await expect(page.getByTestId('code-stale')).toContainText('Stale');
  await page.keyboard.down('Space');
  await drag(page, { x: 40, y: 40 }, { x: 70, y: 60 });
  await page.keyboard.up('Space');
  await expect(page.getByTestId('code-stale')).toContainText('Stale');

  await source(page).fill('Next');
  await page.getByTestId('code-apply').click();
  await expect(page.getByTestId('code-confirm')).toBeVisible();

  // Cancelling changes neither the board nor the text.
  await page.getByTestId('code-confirm-cancel').click();
  await expect(page.getByTestId('code-confirm')).toBeHidden();
  await expect(source(page)).toHaveValue('Next');
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 152 120 L 288 120 C 294.627 120 300 125.373 300 132 L 300 208 C 300 214.627 294.627 220 288 220 L 152 220 C 145.373 220 140 214.627 140 208 L 140 132 C 140 125.373 145.373 120 152 120'
  );

  // Confirming replaces exactly the generated shapes and clears both flags.
  await page.getByTestId('code-apply').click();
  await page.getByTestId('code-confirm-apply').click();
  await expect(page.getByTestId('code-confirm')).toBeHidden();
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 136 124 L 272 124 C 278.627 124 284 129.373 284 136 L 284 212 C 284 218.627 278.627 224 272 224 L 136 224 C 129.373 224 124 218.627 124 212 L 124 136 C 124 129.373 129.373 124 136 124'
  );
  await expect(page.getByTestId('code-stale')).toBeHidden();
  await expect(page.getByTestId('code-pending')).toBeHidden();
  await expect(source(page)).toHaveValue('Next');
});

test('a hand-added shape inside the frame survives an apply', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);
  await source(page).fill('Box');
  await source(page).press('Control+Enter');

  await selectFrame(page);
  await page.keyboard.press('r');
  await drag(page, { x: 340, y: 150 }, { x: 400, y: 200 });
  await expect(clean(page, 'rectangle-2')).toHaveAttribute(
    'd',
    'M 352 150 L 388 150 C 394.627 150 400 155.373 400 162 L 400 188 C 400 194.627 394.627 200 388 200 L 352 200 C 345.373 200 340 194.627 340 188 L 340 162 C 340 155.373 345.373 150 352 150'
  );

  await selectFrame(page);
  await source(page).fill('Next');
  await source(page).press('Control+Enter');

  await expect(clean(page, 'rectangle-2')).toHaveAttribute(
    'd',
    'M 352 150 L 388 150 C 394.627 150 400 155.373 400 162 L 400 188 C 400 194.627 394.627 200 388 200 L 352 200 C 345.373 200 340 194.627 340 188 L 340 162 C 340 155.373 345.373 150 352 150'
  );
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'd',
    'M 136 124 L 272 124 C 278.627 124 284 129.373 284 136 L 284 212 C 284 218.627 278.627 224 272 224 L 136 224 C 129.373 224 124 218.627 124 212 L 124 136 C 124 129.373 129.373 124 136 124'
  );
});

test('the frame grows to hold the diagram and never shrinks', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await page.keyboard.press('f');
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.up();
  await page.mouse.click(box.x + 190, box.y + 190);
  await openCode(page);

  await source(page).fill('Box');
  await source(page).press('Control+Enter');

  await expect(clean(page, 'frame-1')).toHaveAttribute(
    'd',
    'M 100 100 L 308 100 L 308 248 L 100 248 Z'
  );

  await source(page).fill('');
  await source(page).press('Control+Enter');

  await expect(clean(page, 'frame-1')).toHaveAttribute(
    'd',
    'M 100 100 L 308 100 L 308 248 L 100 248 Z'
  );
});
