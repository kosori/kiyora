import { readFile } from 'node:fs/promises';
import { previewBoard } from '@kiyora/model';
import type { Page } from '@playwright/test';
import {
  conflictKey,
  openBoard,
  openLibrary,
  readStoredBoard,
  readStoredKey,
  type SeededBoard,
  seededBoard,
  snapshotKey,
} from '../fixtures/library';
import { expect, test } from '../fixtures/offline';

const BOARD_ID = '77777777-7777-4777-8777-777777777777';

const STYLE = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const localShape = {
  h: 150,
  id: 'local-rectangle',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: STYLE,
  w: 200,
  x: 200,
  y: 150,
};

const remoteShape = {
  h: 80,
  id: 'remote-rectangle',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: STYLE,
  w: 120,
  x: 40,
  y: 40,
};

const localPaint = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';
const remotePaint = 'M 40 40 L 160 40 L 160 120 L 40 120 Z';

const localBoard: SeededBoard = {
  id: BOARD_ID,
  shapes: [localShape],
  sync: { conflict: 7, linked: true, revision: 2 },
  title: 'Local board',
};
const localPreview = previewBoard(seededBoard(localBoard), { theme: 'light' });

const remoteSource: SeededBoard = {
  id: BOARD_ID,
  shapes: [remoteShape],
  title: 'Remote board',
  updatedAt: 1_700_000_000_900,
};
const remoteBoard = seededBoard(remoteSource);

const cached = JSON.stringify({ payload: remoteBoard, revision: 7 });

const recordOf = async (page: Page) =>
  JSON.parse((await readStoredKey(page, 'kiyora:library')) ?? 'null') as {
    boards: {
      conflict?: number;
      id: string;
      linked?: boolean;
      revision?: number;
      title: string;
    }[];
  };

test.describe('a stored conflict', () => {
  test.use({ offlineMode: 'local-api' });

  test('survives a reload, paints both copies, and takes theirs from the cache', async ({
    page,
  }) => {
    await openBoard(
      page,
      { ...localBoard, preview: localPreview ?? undefined },
      {
        raw: { [conflictKey(BOARD_ID)]: cached },
      }
    );

    await expect(page.getByTestId('sync-status')).toHaveAttribute(
      'data-state',
      'conflict'
    );

    await page.reload();
    await expect(page.getByTestId('sync-status')).toHaveAttribute(
      'data-state',
      'conflict'
    );

    await page.getByTestId('open-conflict').click();
    await expect(page.getByTestId('conflict-dialog')).toBeVisible();
    await expect(
      page.getByTestId('conflict-local').locator(`path[d="${localPaint}"]`)
    ).toBeVisible();
    await expect(
      page.getByTestId('conflict-remote').locator(`path[d="${remotePaint}"]`)
    ).toBeVisible();

    await page.getByTestId('take-theirs').click();
    await expect(
      page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
    ).toBeVisible();
    await expect(page.getByTestId('download-replaced')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-replaced').click(),
    ]);
    const path = await download.path();
    const replaced = JSON.parse(await readFile(path ?? '', 'utf8')) as {
      shapes: { id: string }[];
      title: string;
    };
    expect(replaced.title).toBe('Local board');
    expect(replaced.shapes.map(({ id }) => id)).toEqual(['local-rectangle']);

    await page.reload();
    await expect(
      page.getByTestId('board').locator(`path[d="${remotePaint}"]`)
    ).toBeVisible();
    await expect(
      page.getByTestId('board').locator(`path[d="${localPaint}"]`)
    ).toHaveCount(0);

    const stored = JSON.parse((await readStoredBoard(page, BOARD_ID)) ?? '{}');
    expect(stored.title).toBe('Remote board');
    expect(stored.shapes.map(({ id }: { id: string }) => id)).toEqual([
      'remote-rectangle',
    ]);

    const snapshot = JSON.parse(
      (await readStoredKey(page, snapshotKey(BOARD_ID))) ?? '{}'
    );
    expect(snapshot.title).toBe('Local board');
    expect(snapshot.shapes.map(({ id }: { id: string }) => id)).toEqual([
      'local-rectangle',
    ]);

    expect(
      (await recordOf(page)).boards.find((board) => board.id === BOARD_ID)
    ).toMatchObject({ linked: true, revision: 7 });
    expect(await readStoredKey(page, conflictKey(BOARD_ID))).toBeNull();
  });

  test('says to come back online when the remote copy was never cached', async ({
    page,
  }) => {
    const downloads: string[] = [];

    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/boards')) {
        downloads.push(path);
      }
    });

    await openBoard(page, localBoard, { open: `/b/${BOARD_ID}?conflict=1` });

    await expect(page.getByTestId('conflict-dialog')).toBeVisible();
    await expect(page.getByTestId('conflict-offline')).toBeVisible();
    await expect(page.getByTestId('sync-status')).toHaveAttribute(
      'data-state',
      'conflict'
    );
    expect(downloads).toEqual([]);
  });
});

test.describe('reopening a conflict', () => {
  test.use({ offlineMode: 'none' });

  test('is reachable from the library row', async ({ page }) => {
    await openLibrary(page, [localBoard], {
      raw: { [conflictKey(BOARD_ID)]: cached },
    });

    await page.getByTestId('resolve-conflict').click();

    await expect(page).toHaveURL(new RegExp(`/b/${BOARD_ID}\\?conflict=1$`));
    await expect(page.getByTestId('conflict-dialog')).toBeVisible();
  });
});
