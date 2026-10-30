import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * The cut's acceptance journey: one test that walks the code panel the way a
 * person would — open, type a Source, apply, edit a generated shape by hand,
 * apply again, undo, then feed the parser a line it cannot read — and exports
 * the result. Every request that is not to localhost is aborted before the
 * first navigation, so the walk is also the offline proof.
 *
 * Every assertion reads paint or behaviour: a path's `d`, a fill, a flag on
 * screen, a diagnostic's words, and the PNG's own IHDR. Element counts prove
 * nothing here, and none are asserted.
 */

/** The frame the whole journey writes into, clear of the starter rectangle. */
const FRAME = { h: 300, w: 400, x: 500, y: 160 } as const;

/** The frame's own geometry, untouched until a wider diagram grows it. */
const FRAME_BOX = 'M 500 160 L 900 160 L 900 460 L 500 460 Z';

/** Where the layout puts one node: 24 units inside the frame, 160×100. */
const ONE_NODE = 'M 524 184 L 684 184 L 684 284 L 524 284 Z';

/** The centre of the laid-out node, where a hand grabs it. */
const NODE_CENTRE = { x: 604, y: 234 } as const;

/**
 * The same node after a hand drag: 40 units right, which the 8-unit grid rounds
 * to 44 because the layout's 24-unit inset leaves the node off the grid.
 */
const ONE_NODE_MOVED = 'M 568 184 L 728 184 L 728 284 L 568 284 Z';

/** A second readable node on the same rank, below the first. */
const TWO_NODES = 'M 524 324 L 684 324 L 684 424 L 524 424 Z';

/** Two nodes and a line the parser cannot read: the error sits between them. */
const UNREADABLE = 'Box\n->\nOther';

/** The starter rectangle, which no step of the journey may touch. */
const STARTER = 'M 80 80 L 300 80 L 300 220 L 80 220 Z';

/** The pixel box a PNG declares in its own IHDR chunk, read from the file a person would get. */
const pngSize = (bytes: Buffer): { height: number; width: number } => ({
  height: bytes.readUInt32BE(20),
  width: bytes.readUInt32BE(16),
});

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

/** One drag on the canvas, in board pixels. */
const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 });
  await page.mouse.up();
};

/** The frame the Source applies to. */
const drawFrame = async (page: Page) => {
  const box = await canvasBox(page);
  await page.keyboard.press('f');
  await page.mouse.move(box.x + FRAME.x, box.y + FRAME.y);
  await page.mouse.down();
  await page.mouse.move(box.x + FRAME.x + FRAME.w, box.y + FRAME.y + FRAME.h);
  await page.mouse.up();
};

/** Selects the frame by clicking a corner its generated figures never cover. */
const selectFrame = async (page: Page) => {
  const box = await canvasBox(page);
  await page.mouse.click(
    box.x + FRAME.x + FRAME.w - 20,
    box.y + FRAME.y + FRAME.h - 20
  );
};

const openCode = async (page: Page) => {
  await page.getByTestId('rail-tab-code').click();
};

const source = (page: Page) => page.getByTestId('code-source');

const panel = (page: Page) => page.getByTestId('code');

const stale = (page: Page) => page.getByTestId('code-stale');

/** Types a Source and applies it to the selected frame. */
const apply = async (page: Page, text: string) => {
  await source(page).fill(text);
  await source(page).press('Control+Enter');
};

/** Answers the question a stale frame asks before its hand edits are replaced. */
const confirmApply = async (page: Page) => {
  await expect(page.getByTestId('code-confirm')).toBeVisible();
  await page.getByTestId('code-confirm-apply').click();
  await expect(page.getByTestId('code-confirm')).toBeHidden();
};

test('the cut journey passes with every non-localhost request aborted', async ({
  page,
}) => {
  await open(page);
  await drawFrame(page);
  await selectFrame(page);
  await openCode(page);

  // A frame nobody generated from opens an empty panel, and applying a Source
  // stamps its figures inside it as one gesture.
  await expect(source(page)).toHaveValue('');
  await apply(page, 'Box');

  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', ONE_NODE);
  await expect(clean(page, 'rectangle-1')).toHaveAttribute(
    'fill',
    'rgba(25, 113, 194, 0.2)'
  );
  await expect(clean(page, 'frame-1')).toHaveAttribute('d', FRAME_BOX);
  await expect(panel(page)).not.toContainText('Pending');
  await expect(panel(page)).not.toContainText('Stale');

  // Edit the generated figure by hand: the geometry moves and the frame says
  // it is stale, while the text still matches, so nothing is pending.
  await drag(page, NODE_CENTRE, { x: NODE_CENTRE.x + 40, y: NODE_CENTRE.y });

  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', ONE_NODE_MOVED);
  await expect(stale(page)).toContainText('Stale');
  await expect(panel(page)).not.toContainText('Pending');

  // Applying over a hand edit asks first; confirming replaces the generated
  // figure with the new Source's layout.
  await source(page).fill('Next');
  await source(page).press('Control+Enter');
  await confirmApply(page);

  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', ONE_NODE);
  await expect(panel(page)).not.toContainText('Stale');
  await expect(source(page)).toHaveValue('Next');

  // One undo takes the apply back and with it the stale flag, so the hand edit
  // and the fact that it is an edit return together.
  await page.getByTestId('undo').click();

  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', ONE_NODE_MOVED);
  await expect(stale(page)).toContainText('Stale');
  await expect(source(page)).toHaveValue('Box');

  // A line the parser cannot read is one diagnostic; the lines around it still
  // apply, and nothing outside the frame moves.
  await apply(page, UNREADABLE);
  await confirmApply(page);

  const diagnostics = page.getByTestId('code-diagnostic');
  await expect(diagnostics).toHaveAttribute('data-severity', 'error');
  await expect(diagnostics).toContainText('edge needs both ends');
  await expect(diagnostics).toContainText('Line 2');

  await expect(clean(page, 'rectangle-1')).toHaveAttribute('d', ONE_NODE);
  await expect(clean(page, 'rectangle-2')).toHaveAttribute('d', TWO_NODES);
  await expect(clean(page, 'frame-1')).toHaveAttribute('d', FRAME_BOX);
  await expect(clean(page, 'starter-rectangle')).toHaveAttribute('d', STARTER);
  await expect(panel(page)).not.toContainText('Stale');

  // Export the result as PNG at 2× and cross-check the pixels against the SVG
  // the same board exports, so the number comes from the file, not the button.
  await page.getByTestId('png-options').click();
  await page.getByTestId('png-scale-2').click();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-png').click(),
  ]);
  const pixels = pngSize(await readFile(await png.path()));

  const [svgDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await svgDownload.path(), 'utf8');
  const viewBox = (/viewBox="([^"]*)"/.exec(svg)?.[1] ?? '')
    .split(/\s+/)
    .map(Number);

  expect(pixels.width).toBeGreaterThan(0);
  expect(pixels.width).toBe(Math.round((viewBox[2] ?? 0) * 2));
  expect(pixels.height).toBe(Math.round((viewBox[3] ?? 0) * 2));
  expect(svg).toContain('stroke="#1e1e1e"');
});
