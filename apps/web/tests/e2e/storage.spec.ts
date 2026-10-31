import {
  boardStorageKey,
  openExistingBoard,
  openStarterBoard,
  quarantineKey,
  seedBoards,
} from '../fixtures/library';
import { expect, type Page, test } from '../fixtures/offline';

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
const BOARD_ID = 'starter-board';
const BOARD_KEY = boardStorageKey(BOARD_ID);

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
  page.evaluate(async (key): Promise<{ x: number; y: number }[]> => {
    const bytes = await new Promise<string | null>((resolve, reject) => {
      const opening = indexedDB.open('kiyora', 2);
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
          .get(key);
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
  }, BOARD_KEY);

/** A library record that names `BOARD_ID`, for bytes that are not a board. */
const corruptSeed = (bytes: string) => ({
  raw: {
    'kiyora:library': JSON.stringify({
      boards: [{ id: BOARD_ID, title: 'Kiyora', updatedAt: 1 }],
      version: 1,
    }),
    [BOARD_KEY]: bytes,
  },
  record: false,
});

test('an older board is lifted rather than discarded, and its bytes are snapshotted', async ({
  page,
}) => {
  await seedBoards(page, [], {
    legacy: JSON.stringify(LEGACY),
    open: '/b/board-legacy',
    storage: 'local',
  });

  const lifted = page.getByTestId('board').locator(`path[d="${legacyPath}"]`);
  await expect(lifted).toHaveAttribute('fill', 'rgba(25, 113, 194, 0.2)');
  await expect(lifted).toHaveAttribute('stroke', '#1e1e1e');

  await expect(status(page)).toHaveAttribute('data-migrated', '0');
  await expect
    .poll(() =>
      page.evaluate(
        (key) => localStorage.getItem(key),
        'kiyora:boards:board-legacy:snapshot'
      )
    )
    .toBe(JSON.stringify(LEGACY));
});

test('a corrupt board is set aside, and a fresh empty one takes its place', async ({
  page,
}) => {
  await seedBoards(page, [], {
    ...corruptSeed('this is not a board'),
    open: `/b/${BOARD_ID}`,
    storage: 'local',
  });

  await expect(status(page)).toHaveAttribute('data-fault', 'corrupt');
  await expect(status(page)).toContainText('set aside');

  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), quarantineKey(BOARD_ID))
    )
    .toBe('this is not a board');

  await expect
    .poll(() =>
      page.evaluate((key) => {
        const bytes = localStorage.getItem(key);
        if (bytes === null) {
          return null;
        }
        try {
          return (JSON.parse(bytes) as { schemaVersion: number }).schemaVersion;
        } catch {
          return null;
        }
      }, BOARD_KEY)
    )
    .toBe(3);

  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );
});

test('a board from a newer release is set aside rather than guessed at', async ({
  page,
}) => {
  const future = JSON.stringify({ ...LEGACY, schemaVersion: 99 });

  await seedBoards(page, [], {
    ...corruptSeed(future),
    open: `/b/${BOARD_ID}`,
    storage: 'local',
  });

  await expect(status(page)).toHaveAttribute('data-fault', 'corrupt');
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), quarantineKey(BOARD_ID))
    )
    .toBe(future);
});

test('a full disk is reported as quota, and the board stays on screen', async ({
  page,
}) => {
  await openStarterBoard(page, { storage: 'local' });

  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(name, value) {
      if (name === key) {
        throw new DOMException('full', 'QuotaExceededError');
      }
      return original.call(this, name, value);
    };
  }, BOARD_KEY);
  await page.reload();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

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

  await page.goto('/');
  await page.getByTestId('new-board').click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

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

  await page.goto('/');
  await page.getByTestId('new-board').click();
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  await expect(status(page)).toHaveAttribute('data-fault', 'unavailable');
  await drawRectangle(page, { x: 200, y: 150 }, { x: 400, y: 300 });
  const drawn = page
    .getByTestId('board')
    .locator('path[fill="rgba(25, 113, 194, 0.2)"]');
  await expect(drawn).toHaveAttribute(
    'd',
    'M 200 150 L 400 150 L 400 300 L 200 300 Z'
  );
});

test('a second tab warns instead of clobbering the first', async ({
  context,
  page,
}) => {
  await openStarterBoard(page);
  await drawRectangle(page, { x: 200, y: 150 }, { x: 400, y: 300 });
  await expect(status(page)).toHaveAttribute('data-state', 'saved');

  const second = await context.newPage();
  await openExistingBoard(second, BOARD_ID);

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

  await openStarterBoard(page);

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
