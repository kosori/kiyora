import {
  boardStorageKey,
  openExistingBoard,
  readStoredKey,
  seedBoards,
} from '../fixtures/library';
import { expect, test } from '../fixtures/offline';

/**
 * The one upgrade: a browser that held a single board before the library keeps
 * it, as the first board. The proof is the bytes — moved to their own key, the
 * snapshot beside them, the legacy keys gone — and the same paint on screen.
 */

const ID = 'legacy-board';
const PATH = 'M 40 40 L 200 40 L 200 140 L 40 140 Z';
const PAYLOAD = JSON.stringify({
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_600_000_000_000,
  deck: [],
  files: {},
  id: ID,
  schemaVersion: 3,
  settings: { theme: 'light' },
  shapes: [
    {
      h: 100,
      id: 'legacy-rectangle',
      kind: 'rectangle',
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: {
        corner: 'sharp',
        dash: 'solid',
        fill: 'blue',
        fillStyle: 'pastel',
        stroke: 'ink',
        strokeWidth: 2,
      },
      w: 160,
      x: 40,
      y: 40,
    },
  ],
  title: 'Legacy',
  updatedAt: 1_650_000_000_000,
});
const SNAPSHOT = 'the bytes a migration replaced';

test('the single board is adopted as the first library board, and the legacy keys are gone', async ({
  page,
}) => {
  await seedBoards(page, [], {
    legacy: PAYLOAD,
    legacySnapshot: SNAPSHOT,
    open: '/',
    record: false,
    waitFor: 'library',
  });

  await expect(page.getByTestId('library-board')).toContainText('Legacy');

  await expect.poll(() => readStoredKey(page, 'kiyora:board')).toBeNull();
  await expect
    .poll(() => readStoredKey(page, 'kiyora:board:snapshot'))
    .toBeNull();
  await expect
    .poll(() => readStoredKey(page, boardStorageKey(ID)))
    .toBe(PAYLOAD);
  await expect
    .poll(() => readStoredKey(page, `${boardStorageKey(ID)}:snapshot`))
    .toBe(SNAPSHOT);
  await expect
    .poll(async () => {
      const record = await readStoredKey(page, 'kiyora:library');
      return record === null ? null : JSON.parse(record).boards;
    })
    .toEqual([{ id: ID, title: 'Legacy', updatedAt: 1_650_000_000_000 }]);

  await openExistingBoard(page, ID);
  const rectangle = page.getByTestId('board').locator(`path[d="${PATH}"]`);
  await expect(rectangle).toHaveAttribute('fill', 'rgba(25, 113, 194, 0.2)');
  await expect(rectangle).toHaveAttribute('stroke', '#1e1e1e');
});

test('a later open does not adopt it again or duplicate the list entry', async ({
  page,
}) => {
  await seedBoards(page, [], {
    legacy: PAYLOAD,
    legacySnapshot: SNAPSHOT,
    open: '/',
    record: false,
    waitFor: 'library',
  });

  await page.reload();

  await expect(page.getByTestId('library-board').nth(0)).toContainText(
    'Legacy'
  );
  await expect(page.getByTestId('library-board').nth(1)).toBeHidden();
  await expect.poll(() => readStoredKey(page, 'kiyora:board')).toBeNull();
});
