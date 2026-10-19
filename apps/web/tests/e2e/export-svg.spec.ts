import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

/** Wait for the surface to say it can act, so paint is on screen before a gesture. */
const open = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
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

/** Labels the starter rectangle, draws a second one beside it and joins the two. */
const drawADiagram = async (page: Page, box: { x: number; y: number }) => {
  await page.mouse.dblclick(box.x + 190, box.y + 150);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Export');
  await editor.blur();

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 500, y: box.y + 80 },
    { x: box.x + 640, y: box.y + 220 }
  );

  await page.keyboard.press('c');
  // Off the label: a drag that starts on painted text is cancelled by the browser.
  await drag(
    page,
    { x: box.x + 110, y: box.y + 200 },
    { x: box.x + 560, y: box.y + 150 }
  );

  await expect(
    board(page).locator('path[data-shape="connector-1"][fill="none"]').first()
  ).toHaveAttribute('stroke', '#1e1e1e');
};

const exportSvg = async (page: Page): Promise<string> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);

  expect(download.suggestedFilename()).toBe('kiyora.svg');
  return readFile(await download.path(), 'utf8');
};

test('the board comes out as one SVG that keeps the hand-drawn strokes, the connector and the label', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await drawADiagram(page, box);

  const svg = await exportSvg(page);

  expect(svg).toMatch(
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d. -]+">/
  );
  expect(svg).toContain('data-wobble="true"');
  expect(svg).toContain('fill-opacity="0.66"');
  expect(svg).toContain('>Export<');
  expect(/<path [^>]*fill="none"[^>]*stroke="[^"]+"/.test(svg)).toBe(true);
});

test('the exported SVG is the drawing, not a screenshot of the editor', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await drawADiagram(page, box);

  const svg = await exportSvg(page);

  expect(svg).not.toContain('<script');
  expect(svg).not.toContain('<style');
  expect(svg).not.toContain('<foreignObject');
  expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
  expect(svg).not.toContain('data-testid');
  expect(svg).not.toContain('<pattern');
  expect(svg).not.toContain('kiyora-dot-grid');
  expect(svg).not.toContain('handle-');
  expect(svg).not.toContain('selection');
});

test('every reference in the exported SVG points inside the file', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);
  await drawADiagram(page, box);

  const svg = await exportSvg(page);
  const references = [...svg.matchAll(/https?:\/\/[^"')\s]+/g)].map(
    (match) => match[0]
  );

  expect(references).toEqual(['http://www.w3.org/2000/svg']);
  for (const url of [...svg.matchAll(/url\(([^)]*)\)/g)]) {
    expect(url[1]?.startsWith('#')).toBe(true);
  }
});
