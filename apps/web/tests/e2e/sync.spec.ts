import type { Page } from '@playwright/test';
import { openBoard, readStoredBoard } from '../fixtures/library';
import { expect, test } from '../fixtures/offline';

const MIB = 1024 * 1024;
const SYNC_LIMIT = 4 * MIB;

const BOARD_ID = '22222222-2222-4222-8222-222222222222';
const HUGE_ID = '33333333-3333-4333-8333-333333333333';

const drawnPaint = 'M 200 150 L 400 150 L 400 300 L 200 300 Z';

const canvasBox = async (page: Page) => {
  const box = await page.getByTestId('canvas').boundingBox();

  if (box === null) {
    throw new Error('the canvas has no box');
  }

  return box;
};

const drawRectangle = async (page: Page): Promise<void> => {
  const box = await canvasBox(page);

  await page.keyboard.press('r');
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.up();
};

/** Records every sync request the page attempts, so "sends nothing" is provable. */
const watchSyncRequests = (page: Page): string[] => {
  const seen: string[] = [];

  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/boards')) {
      seen.push(request.url());
    }
  });

  return seen;
};

/** One board carrying a raster whose encoded bytes push it over the sync limit. */
const overLimit = (): Record<string, unknown> => ({
  huge: {
    bytes: 1,
    dataURL: `data:image/png;base64,${'A'.repeat(4.2 * MIB)}`,
    mime: 'image/png',
  },
});

test.describe('signed out', () => {
  test('a linked board says so and sends nothing, even after an edit', async ({
    page,
  }) => {
    const requests = watchSyncRequests(page);

    await openBoard(page, {
      id: BOARD_ID,
      sync: { linked: true, revision: 3 },
      title: 'Linked',
    });

    await expect(page.getByTestId('sync-status')).toHaveAttribute(
      'data-state',
      'signed-out'
    );

    await drawRectangle(page);
    await expect(
      page.getByTestId('board').locator(`path[d="${drawnPaint}"]`)
    ).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveAttribute(
      'data-state',
      'saved'
    );

    expect(requests).toEqual([]);
  });

  test('a board over the limit says too large and keeps saving locally', async ({
    page,
  }) => {
    const requests = watchSyncRequests(page);

    await openBoard(page, {
      files: overLimit(),
      id: HUGE_ID,
      title: 'Huge',
    });

    await expect(page.getByTestId('sync-status')).toHaveAttribute(
      'data-state',
      'too-large'
    );
    await expect(page.getByTestId('sync-status')).toHaveAttribute(
      'data-limit',
      String(SYNC_LIMIT)
    );
    expect(
      Number(await page.getByTestId('sync-status').getAttribute('data-bytes'))
    ).toBeGreaterThan(SYNC_LIMIT);

    await drawRectangle(page);
    await expect(
      page.getByTestId('board').locator(`path[d="${drawnPaint}"]`)
    ).toBeVisible();

    await expect
      .poll(async () => {
        const stored = JSON.parse(
          (await readStoredBoard(page, HUGE_ID)) ?? '{}'
        );
        return stored.shapes.some(
          (shape: { kind?: string; x?: number }) =>
            shape.kind === 'rectangle' && shape.x === 200
        );
      })
      .toBe(true);

    expect(requests).toEqual([]);
  });
});
