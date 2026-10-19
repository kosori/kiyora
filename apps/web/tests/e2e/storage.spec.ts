import { expect, type Page, test } from '@playwright/test';

/**
 * The failure paths, driven at the browser seam. Each fault is injected by
 * replacing `indexedDB` or `localStorage` before the app boots — the same seam
 * the rest of the suite uses — rather than by building a second one for storage.
 */

/** A board saved before the record carried a version marker. */
const LEGACY = {
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  id: 'board-legacy',
  settings: { theme: 'light' },
  shapes: [
    {
      h: 80,
      id: 'legacy-rectangle',
      kind: 'rectangle',
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: {
        fill: 'blue',
        fillStyle: 'pastel',
        stroke: 'ink',
        strokeWidth: 2,
      },
      w: 120,
      x: 8,
      y: 8,
    },
  ],
  title: 'Legacy',
  updatedAt: 1_700_000_000_000,
};

const legacyPath = 'M 8 8 L 128 8 L 128 88 L 8 88 Z';

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

const drawRectangle = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<void> => {
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y);
  await page.mouse.up();
};

const status = (page: Page) => page.getByTestId('save-status');

/** The shapes the browser has actually written, read from IndexedDB. */
const storedShapes = (page: Page) =>
  page.evaluate(async (): Promise<{ x: number; y: number }[]> => {
    const bytes = await new Promise<string | null>((resolve, reject) => {
      const opening = indexedDB.open('kiyora', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const database = opening.result;
        if (!database.objectStoreNames.contains('boards')) {
          resolve(null);
          return;
        }
        const request = database
          .transaction('boards', 'readonly')
          .objectStore('boards')
          .get('kiyora:board');
        request.onerror = () => reject(request.error);
        request.onsuccess = () =>
          resolve((request.result as string | undefined) ?? null);
      };
    });

    if (bytes === null) {
      return [];
    }
    const board = JSON.parse(bytes) as { shapes: { x: number; y: number }[] };
    return board.shapes.map(({ x, y }) => ({ x, y }));
  });

test('an older board is lifted rather than discarded, and its bytes are snapshotted', async ({
  page,
}) => {
  await page.addInitScript((seed) => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    localStorage.setItem('kiyora:board', seed);
  }, JSON.stringify(LEGACY));

  await open(page);

  const lifted = page.getByTestId('board').locator(`path[d="${legacyPath}"]`);
  await expect(lifted).toHaveAttribute('fill', 'rgba(25, 113, 194, 0.2)');
  await expect(lifted).toHaveAttribute('stroke', '#1e1e1e');

  await expect(status(page)).toHaveAttribute('data-migrated', '0');
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('kiyora:board:snapshot'))
    )
    .toBe(JSON.stringify(LEGACY));
});

test('a corrupt board is set aside, never overwritten by a fresh one', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    localStorage.setItem('kiyora:board', 'this is not a board');
  });

  await open(page);

  await expect(status(page)).toHaveAttribute('data-fault', 'corrupt');
  await expect(status(page)).toContainText('set aside');

  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('kiyora:board:quarantine'))
    )
    .toBe('this is not a board');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const bytes = localStorage.getItem('kiyora:board');
        if (bytes === null) {
          return null;
        }
        try {
          return (JSON.parse(bytes) as { schemaVersion: number }).schemaVersion;
        } catch {
          return null;
        }
      })
    )
    .toBe(1);

  const fresh = page.getByTestId('board').locator('path[fill="#2f9e44"]');
  await expect(fresh).toBeVisible();
});

test('a board from a newer release is set aside rather than guessed at', async ({
  page,
}) => {
  const future = JSON.stringify({ ...LEGACY, schemaVersion: 99 });

  await page.addInitScript((seed) => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    localStorage.setItem('kiyora:board', seed);
  }, future);

  await open(page);

  await expect(status(page)).toHaveAttribute('data-fault', 'corrupt');
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('kiyora:board:quarantine'))
    )
    .toBe(future);
});

test('a full disk is reported as quota, and the board stays on screen', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'kiyora:board') {
        throw new DOMException('full', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });

  await open(page);
  await drawRectangle(page, { x: 200, y: 150 }, { x: 400, y: 300 });

  await expect(status(page)).toHaveAttribute('data-fault', 'quota');
  await expect(status(page)).toContainText('free some space');

  const drawn = page
    .getByTestId('board')
    .locator('path[fill="rgba(25, 113, 194, 0.2)"]');
  await expect(drawn).toHaveAttribute(
    'd',
    'M 200 150 L 400 150 L 400 300 L 200 300 Z'
  );
});

test('blocked storage is reported distinctly from a full one', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });

  await open(page);

  await expect(status(page)).toHaveAttribute('data-fault', 'blocked');
  await expect(status(page)).toContainText('allow site data');
});

test('missing storage is reported as unavailable, and the board still works', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: undefined,
    });
  });

  await open(page);

  await expect(status(page)).toHaveAttribute('data-fault', 'unavailable');
  await expect(
    page.getByTestId('board').locator('path[fill="#2f9e44"]')
  ).toBeVisible();
});

test('a second tab warns instead of clobbering the first', async ({
  context,
  page,
}) => {
  await open(page);
  await drawRectangle(page, { x: 200, y: 150 }, { x: 400, y: 300 });
  await expect(status(page)).toHaveAttribute('data-state', 'saved');

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect(status(second)).toHaveAttribute('data-secondary', 'true');
  await expect(status(second)).toContainText('another tab');

  await drawRectangle(second, { x: 600, y: 150 }, { x: 800, y: 300 });

  const stored = await storedShapes(page);
  expect(stored).toContainEqual({ x: 200, y: 150 });
  expect(stored).not.toContainEqual({ x: 600, y: 150 });

  await second.close();
});

test('a panel that throws leaves the board intact and says what to do next', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('kiyora:test:crash-panel:tools', '1');
  });

  await open(page);

  const panel = page.getByTestId('panel-error');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('board is safe');
  await expect(
    panel.getByRole('button', { name: 'Reload to try again' })
  ).toBeVisible();

  await expect(
    page.getByTestId('board').locator('path[fill="#2f9e44"]')
  ).toBeVisible();
});
