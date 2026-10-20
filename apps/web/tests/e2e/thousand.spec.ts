import { expect, type Page, type TestInfo, test } from '@playwright/test';
import {
  boardOfAThousandShapes,
  boxPath,
  FAR,
  HERO,
  SHAPE_COUNT,
} from './thousand-board';

/**
 * The thousand-shape board (#39): the one architectural claim of v1 that had
 * nothing measuring it. The gate is culling — how many nodes the board puts in
 * the DOM is the property the renderer owns, so the count is asserted here on
 * purpose, where invariant 1 otherwise forbids counting. What a person sees is
 * still asserted as paint: exact paths, named by shape.
 *
 * The frame ceiling is a tripwire, not the gate. A headless CI box shares its
 * CPU, so the ceiling is loose enough not to flake and every test reports the
 * numbers it measured, so a human reads the cost instead of trusting it.
 *
 * The dev server compiles lazily, so the file takes a longer timeout than the
 * default; the numbers, not the wall clock, are what this file is for.
 */
test.describe.configure({ timeout: 120_000 });

/** How many elements the board may hold while a normal view is on screen. */
const NODE_BUDGET = 250;

/**
 * The median frame a drag or a pan may cost, in milliseconds. Loose on purpose:
 * on a shared headless box this run measures about 17 ms while dragging and
 * 120–140 ms while panning a thousand shapes through the dev server, with other
 * checkouts compiling beside it. Twice the expensive case is a tripwire for a
 * gross regression, not a frame budget — the node count is the gate.
 */
const MEDIAN_FRAME_CEILING_MS = 250;

/** The board the test opens: a thousand shapes, seeded before any app code runs. */
const openThousand = async (page: Page): Promise<void> => {
  const board = JSON.stringify(boardOfAThousandShapes());

  await page.addInitScript((bytes: string) => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    localStorage.setItem('kiyora:board', bytes);
  }, board);

  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30_000 }
  );
};

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const painted = (page: Page, shapeId: string) =>
  page.getByTestId('board').locator(`path[data-shape="${shapeId}"]`);

/** Every element the board holds, mixed shapes, labels and heads together. */
const paintedNodes = (page: Page): Promise<number> =>
  page
    .getByTestId('board')
    .evaluate((board) => board.querySelectorAll('*').length);

const startFrames = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const window_ = window as unknown as {
      __frames?: number[];
      __stopFrames?: () => number[];
    };
    const frames: number[] = [];
    let last = performance.now();
    let running = true;
    const tick = (now: number) => {
      if (!running) {
        return;
      }
      frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };

    window_.__frames = frames;
    window_.__stopFrames = () => {
      running = false;
      return frames;
    };
    requestAnimationFrame(tick);
  });

const stopFrames = (page: Page): Promise<number[]> =>
  page.evaluate(() => {
    const window_ = window as unknown as { __stopFrames?: () => number[] };
    return window_.__stopFrames?.() ?? [];
  });

type Frames = {
  count: number;
  max: number;
  median: number;
  p95: number;
};

const summarise = (frames: number[]): Frames => {
  const sorted = [...frames].sort((a, b) => a - b);
  const at = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ??
    0;

  return {
    count: sorted.length,
    max: at(0.999),
    median: at(0.5),
    p95: at(0.95),
  };
};

const report = (
  info: TestInfo,
  what: string,
  nodes: number,
  frames: number[] = []
): Frames => {
  const measured = summarise(frames);
  const timing =
    measured.count === 0
      ? 'no drag frames measured'
      : `median ${measured.median.toFixed(1)} ms, p95 ${measured.p95.toFixed(1)} ms, max ${measured.max.toFixed(1)} ms over ${measured.count} frames`;
  const description = `${what}: ${timing}; ${nodes} nodes in the board`;

  info.annotations.push({ description, type: 'measured' });
  console.log(`[thousand shapes] ${description}`);

  return measured;
};

/**
 * One drag from a screen point, in small steps so frames are actually drawn.
 * Frames are recorded only while the button is held: a headless page that is
 * waiting between gestures can throttle its animation frames, and an idle gap
 * is not a slow frame.
 */
const drag = async (
  page: Page,
  from: { x: number; y: number },
  delta: { x: number; y: number },
  button: 'left' | 'middle' = 'left',
  steps = 16
): Promise<number[]> => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await startFrames(page);

  for (let step = 1; step <= steps; step += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: a drag is ordered; each step must land before the next
    await page.mouse.move(
      from.x + (delta.x * step) / steps,
      from.y + (delta.y * step) / steps
    );
    await page.waitForTimeout(8);
  }

  const frames = await stopFrames(page);
  await page.mouse.up({ button });

  return frames;
};

test('only the shapes in view are in the DOM, and all thousand are on the board', async ({
  page,
}, info) => {
  await openThousand(page);

  const nodes = await paintedNodes(page);
  report(info, 'opening a thousand shapes', nodes);

  expect(nodes).toBeGreaterThan(0);
  expect(nodes).toBeLessThan(NODE_BUDGET);

  await expect(painted(page, 'shape-0')).toHaveAttribute('d', boxPath(HERO));
  await expect(painted(page, FAR.id)).toHaveCount(0);
  await expect(
    page
      .getByTestId('board')
      .locator('path[d="M 80 80 L 300 80 L 300 220 L 80 220 Z"]')
  ).toHaveCount(0);
});

test('dragging a shape moves that shape and keeps frames under the tripwire', async ({
  page,
}, info) => {
  await openThousand(page);
  const box = await canvasBox(page);
  const hero = {
    x: box.x + HERO.x + HERO.w / 2,
    y: box.y + HERO.y + HERO.h / 2,
  };
  const moved = { ...HERO, x: HERO.x + 80, y: HERO.y + 64 };

  const frames = await drag(page, hero, { x: 80, y: 64 });

  await expect(painted(page, 'shape-0')).toHaveAttribute('d', boxPath(moved));

  const nodes = await paintedNodes(page);
  const measured = report(info, 'dragging one shape', nodes, frames);

  expect(nodes).toBeLessThan(NODE_BUDGET);
  expect(measured.median).toBeLessThan(MEDIAN_FRAME_CEILING_MS);

  const stored = () =>
    page.evaluate(() => {
      const bytes = localStorage.getItem('kiyora:board');
      const board =
        bytes === null
          ? null
          : (JSON.parse(bytes) as {
              shapes: { id: string; kind: string; x: number }[];
            });

      return board?.shapes.find((shape) => shape.id === 'shape-0') ?? null;
    });

  await expect.poll(async () => (await stored())?.x).toBe(moved.x);

  const saved = await page.evaluate(() => {
    const bytes = localStorage.getItem('kiyora:board');
    const board =
      bytes === null
        ? null
        : (JSON.parse(bytes) as { shapes: { kind: string }[] });

    return board?.shapes.map((shape) => shape.kind) ?? [];
  });
  const kinds = [...new Set(saved)].sort();

  expect(saved).toHaveLength(SHAPE_COUNT);
  expect(kinds).toEqual(
    [
      'connector',
      'diamond',
      'ellipse',
      'rectangle',
      'sticky',
      'text',
      'triangle',
    ].sort()
  );
});

test('panning the whole board keeps the DOM to the view and frames under the tripwire', async ({
  page,
}, info) => {
  await openThousand(page);
  const box = await canvasBox(page);
  const from = { x: box.x + box.width - 70, y: box.y + box.height - 120 };

  const frames: number[] = [];
  for (let move = 0; move < 9; move += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each pan gesture has to finish before the next begins
    frames.push(...(await drag(page, from, { x: -650, y: 0 }, 'middle', 8)));
  }
  for (let move = 0; move < 7; move += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each pan gesture has to finish before the next begins
    frames.push(...(await drag(page, from, { x: 0, y: -400 }, 'middle', 8)));
  }

  await expect(painted(page, 'shape-0')).toHaveCount(0);
  await expect(painted(page, FAR.id)).toHaveAttribute('d', boxPath(FAR));

  const nodes = await paintedNodes(page);
  const measured = report(info, 'panning the whole board', nodes, frames);

  expect(nodes).toBeLessThan(NODE_BUDGET);
  expect(measured.median).toBeLessThan(MEDIAN_FRAME_CEILING_MS);
});
