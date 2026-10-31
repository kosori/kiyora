import {
  boardStorageKey,
  openStarterBoard,
  readStoredBoard,
} from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

const TRANSFORM = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/;

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

const camera = async (page: Page): Promise<Camera> => {
  const value = await page.getByTestId('board').getAttribute('transform');
  const match = TRANSFORM.exec(value ?? '');

  if (match === null) {
    throw new Error(`the board is not placed by a camera: ${value}`);
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    zoom: Number(match[3]),
  };
};

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

/** A rectangle the starter board places: 80,80 at 220x140, in board units. */
const starterPaint = {
  d: 'M 80 80 L 300 80 L 300 220 L 80 220 Z',
  fill: '#2f9e44',
};

/** The rectangle drawn at 200,150 → 400,300, in board units. */
const drawnPaint = {
  d: 'M 200 150 L 400 150 L 400 300 L 200 300 Z',
  fill: 'rgba(25, 113, 194, 0.2)',
  stroke: '#1e1e1e',
};

const drawnRectangle = (page: Page) =>
  page.getByTestId('board').locator(`path[d="${drawnPaint.d}"]`);

const starterRectangle = (page: Page) =>
  page.getByTestId('board').locator(`path[fill="${starterPaint.fill}"]`);

const drawRectangle = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.up();
};

const pan = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<void> => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
};

/** The camera the browser has actually written, read from IndexedDB. */
const storedCamera = async (page: Page): Promise<Camera | null> => {
  const bytes = await readStoredBoard(page, 'starter-board');

  return bytes === null
    ? null
    : (JSON.parse(bytes) as { camera: Camera }).camera;
};

const WATCH_SAVE_STATE = () => {
  const key = '__kiyoraSaveStates';
  const store = window as unknown as Record<string, string[]>;
  const seen: string[] = [];
  store[key] = seen;

  const record = () => {
    const state = document
      .querySelector('[data-testid="save-status"]')
      ?.getAttribute('data-state');
    if (state !== null && state !== undefined && seen.at(-1) !== state) {
      seen.push(state);
    }
  };

  new MutationObserver(record).observe(document, {
    attributeFilter: ['data-state'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  record();
};

const saveStates = (page: Page) =>
  page.evaluate(
    () => (window as unknown as Record<string, string[]>).__kiyoraSaveStates
  );

test('the board is written after the last change, and a reload finds it painted', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect(drawnRectangle(page)).toHaveAttribute('fill', drawnPaint.fill);
  await expect(drawnRectangle(page)).toHaveAttribute(
    'stroke',
    drawnPaint.stroke
  );
  await expect(drawnRectangle(page)).toHaveAttribute('stroke-width', '2');
  await expect(starterRectangle(page)).toHaveAttribute('d', starterPaint.d);
});

test('the status says the work is saved, and shows it was unsaved first', async ({
  page,
}) => {
  await page.addInitScript(WATCH_SAVE_STATE);
  await open(page);
  await drawRectangle(page);

  await expect(page.getByTestId('save-status')).toHaveText('Saved');

  const states = (await saveStates(page)) ?? [];

  expect(states).toContain('unsaved');
  expect(states.at(-1)).toBe('saved');
});

test('a pan alone is flushed as the tab hides, so the view comes back', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await pan(page, { x: 600, y: 300 }, { x: 660, y: 340 });
  const left = await camera(page);
  expect(left.x).toBeCloseTo(60, 0);
  expect(left.y).toBeCloseTo(40, 0);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect.poll(() => storedCamera(page)).toEqual(left);

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect.poll(() => camera(page)).toEqual(left);
});

test('a pan alone is flushed as the page goes away, so the view comes back', async ({
  page,
}) => {
  await open(page);
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );

  await pan(page, { x: 600, y: 300 }, { x: 660, y: 340 });
  const left = await camera(page);
  expect(left.x).toBeCloseTo(60, 0);
  expect(left.y).toBeCloseTo(40, 0);

  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'));
  });

  await expect.poll(() => storedCamera(page)).toEqual(left);

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect.poll(() => camera(page)).toEqual(left);
});

test('a board is saved and read back without IndexedDB, through the fallback', async ({
  page,
}) => {
  await openStarterBoard(page, { storage: 'local' });
  await drawRectangle(page);
  await expect(page.getByTestId('save-status')).toHaveAttribute(
    'data-state',
    'saved'
  );
  await expect
    .poll(() =>
      page.evaluate(
        (key) => localStorage.getItem(key),
        boardStorageKey('starter-board')
      )
    )
    .not.toBeNull();

  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect(drawnRectangle(page)).toHaveAttribute('fill', drawnPaint.fill);
  await expect(drawnRectangle(page)).toHaveAttribute(
    'stroke',
    drawnPaint.stroke
  );
  await expect(starterRectangle(page)).toHaveAttribute('d', starterPaint.d);
});
