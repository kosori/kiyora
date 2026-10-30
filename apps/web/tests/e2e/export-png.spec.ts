import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '../fixtures/offline';

/**
 * The pixel box a PNG declares in its own IHDR chunk, read from the file the
 * user would get rather than from anything the app claims about it.
 */
const pngSize = (bytes: Buffer): { width: number; height: number } => ({
  height: bytes.readUInt32BE(20),
  width: bytes.readUInt32BE(16),
});

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

/** Chooses the ellipse from the picker, the round figure a corner can miss. */
const chooseEllipse = async (page: Page): Promise<void> => {
  await page.getByTestId('shape-picker').click();
  await page.getByRole('menuitem', { name: 'Ellipse' }).click();
};

/** Takes an export through the panel and hands back the file's bytes. */
const exportPng = async (page: Page): Promise<Buffer> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-png').click(),
  ]);

  expect(download.suggestedFilename()).toBe('kiyora.png');
  return readFile(await download.path());
};

/** The page's own measure of one string in a family stack, at a size that hides rounding. */
const textWidth = async (page: Page, family: string): Promise<number> =>
  await page.evaluate((stack) => {
    const context = document.createElement('canvas').getContext('2d');
    if (context === null) {
      throw new Error('the page offered no 2D context');
    }
    context.font = `200px ${stack}`;
    return context.measureText('ship it').width;
  }, family);

type RasterWindow = Window & { __rasterSvg?: Promise<string> };

/**
 * The SVG document the raster is drawn from, captured as it leaves the app. The
 * raster is an artifact in its own right: it carries the faces, and a test that
 * never sees it can only guess whether the text resolved to one.
 */
const captureRaster = async (page: Page): Promise<string> => {
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    const scope = window as RasterWindow;
    scope.__rasterSvg = undefined;
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob && object.type === 'image/svg+xml') {
        scope.__rasterSvg = object.text();
      }
      return create(object);
    };
  });

  await exportPng(page);

  return await page.evaluate(async () => {
    const scope = window as RasterWindow;
    if (scope.__rasterSvg === undefined) {
      throw new Error('the raster left no document');
    }
    return await scope.__rasterSvg;
  });
};

/** Opens the panel and picks one option from one of its groups. */
const pick = async (
  page: Page,
  group: string,
  value: string
): Promise<void> => {
  await page.getByTestId(`${group}-${value}`).click();
};

type Rgba = [number, number, number, number];

type Probe = { height: number; samples: Rgba[]; width: number };

const LONG_NOTE =
  'Remember to ship the note before the demo, then walk the deck once more and close the loop with the team on Friday, and after that send the summary to everyone who could not make it and file the follow-ups in the board';

/** The height a rectangle path spans, read from its own coordinates. */
const pathHeight = (d: string): number => {
  const values = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const ys = values.filter((_, index) => index % 2 === 1);

  return Math.max(...ys) - Math.min(...ys);
};

/** Reads pixels out of PNG bytes through the browser's own decoder. */
const probe = async (
  page: Page,
  bytes: Buffer,
  points: { x: number; y: number }[]
): Promise<Probe> =>
  await page.evaluate(
    async ({ data, points: where }) => {
      const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');

      if (context === null) {
        throw new Error('the page offered no 2D context');
      }

      context.drawImage(bitmap, 0, 0);

      return {
        height: bitmap.height,
        samples: where.map((point) => {
          const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(
            point.x,
            point.y,
            1,
            1
          ).data;
          return [r, g, b, a] as [number, number, number, number];
        }),
        width: bitmap.width,
      };
    },
    { data: [...bytes], points }
  );

/** One probe sample, or a black pixel when a probe somehow returned none. */
const sampleAt = (result: Probe, index: number): Rgba =>
  result.samples[index] ?? [0, 0, 0, 0];

/** Asserts one pixel's channels, allowing for the odd rounding of a rasteriser. */
const expectPixel = (sample: Rgba, expected: Rgba, tolerance = 4): void => {
  for (const [index, value] of expected.entries()) {
    expect(Math.abs((sample[index] ?? 0) - value)).toBeLessThanOrEqual(
      tolerance
    );
  }
};

test('the PNG comes out at exactly the scale the panel asks for', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('png-options').click();

  await pick(page, 'png-scale', '1');
  expect(pngSize(await exportPng(page))).toEqual({ height: 140, width: 220 });

  await pick(page, 'png-scale', '2');
  expect(pngSize(await exportPng(page))).toEqual({ height: 280, width: 440 });

  await pick(page, 'png-scale', '4');
  expect(pngSize(await exportPng(page))).toEqual({ height: 560, width: 880 });
});

/** Places an ellipse clear of the starter rectangle and selects it. */
const roundShape = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);

  await chooseEllipse(page);
  await drag(
    page,
    { x: box.x + 400, y: box.y + 304 },
    { x: box.x + 600, y: box.y + 448 }
  );
  await page.mouse.click(box.x + 500, box.y + 376);
};

test('the export is the whole board, or just the selection', async ({
  page,
}) => {
  await open(page);
  await roundShape(page);

  await page.getByTestId('png-options').click();
  await pick(page, 'png-scale', '1');

  await pick(page, 'png-target', 'selection');
  expect(pngSize(await exportPng(page))).toEqual({ height: 144, width: 200 });

  await pick(page, 'png-target', 'board');
  expect(pngSize(await exportPng(page))).toEqual({ height: 368, width: 520 });
});

test('a transparent export has transparent corners and a solid one does not', async ({
  page,
}) => {
  await open(page);
  await roundShape(page);

  await page.getByTestId('png-options').click();
  await pick(page, 'png-target', 'selection');
  await pick(page, 'png-scale', '2');

  const corners = [
    { x: 0, y: 0 },
    { x: 399, y: 287 },
  ];

  await pick(page, 'png-background', 'transparent');
  const clear = await probe(page, await exportPng(page), corners);
  expect(clear.samples.map(([, , , alpha]) => alpha)).toEqual([0, 0]);

  await pick(page, 'png-background', 'solid');
  const solid = await probe(page, await exportPng(page), corners);
  for (const sample of solid.samples) {
    expectPixel(sample, [255, 255, 255, 255]);
  }
});

test('the export theme is its own, so a light board can leave as a dark image', async ({
  page,
}) => {
  await open(page);
  await roundShape(page);

  await expect(
    page.getByTestId('board').locator('path[data-shape="ellipse-1"]').first()
  ).toHaveAttribute('stroke', '#1e1e1e');

  await page.getByTestId('png-options').click();
  await pick(page, 'png-target', 'selection');
  await pick(page, 'png-scale', '2');
  await pick(page, 'png-background', 'solid');

  const at = [
    { x: 0, y: 0 },
    { x: 0, y: 144 },
  ];

  await pick(page, 'png-theme', 'light');
  const light = await probe(page, await exportPng(page), at);
  expectPixel(sampleAt(light, 0), [255, 255, 255, 255]);
  expectPixel(sampleAt(light, 1), [30, 30, 30, 255]);

  await pick(page, 'png-theme', 'dark');
  const dark = await probe(page, await exportPng(page), at);
  expectPixel(sampleAt(dark, 0), [30, 30, 30, 255]);
  expectPixel(sampleAt(dark, 1), [233, 236, 239, 255]);

  await expect(
    page.getByTestId('board').locator('path[data-shape="ellipse-1"]').first()
  ).toHaveAttribute('stroke', '#1e1e1e');
});

test('a refitted note exports at the box it paints, in the SVG and the PNG', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await document.fonts.load("16px 'Balsamiq Sans Neue'");
    await document.fonts.ready;
  });
  const box = await canvasBox(page);

  await page.keyboard.press('s');
  await page.mouse.click(box.x + 400, box.y + 300);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill(LONG_NOTE);
  await editor.blur();

  await page.mouse.click(box.x + 400, box.y + 300);

  const painted =
    (await page
      .getByTestId('board')
      .locator('path[data-shape="sticky-1"]')
      .getAttribute('d')) ?? '';
  const height = pathHeight(painted);
  expect(height).toBeGreaterThan(160);

  await page.getByTestId('png-options').click();
  await pick(page, 'png-target', 'selection');
  await pick(page, 'png-scale', '1');
  expect(pngSize(await exportPng(page)).height).toBe(Math.round(height));

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const svg = await readFile(await download.path(), 'utf8');

  expect(svg).toContain(painted);
});

test('a board past the size cap is refused, and no file is written', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.wheel(0, 1500);

  await page.keyboard.press('r');
  await drag(
    page,
    { x: box.x + 40, y: box.y + 40 },
    { x: box.x + box.width - 40, y: box.y + box.height - 40 }
  );

  let downloaded = false;
  page.on('download', () => {
    downloaded = true;
  });

  await page.getByTestId('png-options').click();
  await pick(page, 'png-scale', '1');
  await page.getByTestId('download-png').click();

  await expect(page.getByTestId('file-error')).toContainText('past the');
  expect(downloaded).toBe(false);
});

test('a PNG export asks the network for nothing but the app’s own assets', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('png-options').click();
  const bytes = await exportPng(page);

  expect(pngSize(bytes)).toEqual({ height: 280, width: 440 });
});

test('inline code leaves in the vendored mono face, not a fallback', async ({
  page,
}) => {
  await open(page);
  const box = await canvasBox(page);

  await page.getByRole('button', { name: 'Text' }).click();
  await page.mouse.click(box.x + 300, box.y + 200);
  const editor = page.getByTestId('text-editor');
  await expect(editor).toBeVisible();
  await editor.fill('`ship it`');
  await editor.blur();

  await page.evaluate(async () => {
    await document.fonts.load("200px 'Geist Mono'");
    await document.fonts.ready;
  });

  const stack = "'Geist Mono', ui-monospace, monospace";
  const onPage = await textWidth(page, stack);
  const pageFallback = await textWidth(page, 'ui-monospace, monospace');
  expect(onPage).not.toBeCloseTo(pageFallback, 1);

  await page.getByTestId('png-options').click();
  const raster = await captureRaster(page);
  expect(raster.startsWith('<svg')).toBe(true);

  await page.setContent(raster);
  await page.evaluate(async () => {
    await document.fonts.load("200px 'Geist Mono'");
    await document.fonts.ready;
  });

  const inRaster = await textWidth(page, stack);
  const rasterFallback = await textWidth(page, 'ui-monospace, monospace');

  expect(inRaster).toBeCloseTo(onPage, 1);
  expect(inRaster).not.toBeCloseTo(rasterFallback, 1);
});
