import { copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStarterBoard } from '../fixtures/library';
import { expect, test } from '../fixtures/offline';

test.describe('with the network off', () => {
  test.use({ offlineMode: 'local-api' });

  test('the editor works with every non-localhost request aborted', async ({
    page,
  }) => {
    await openStarterBoard(page);

    await expect(
      page.getByTestId('canvas').locator('path').first()
    ).toHaveAttribute('fill', '#2f9e44');
  });
});

test('the exported board opens as a file with the network off, and shows the board', async ({
  context,
  page,
}) => {
  await openStarterBoard(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg').click(),
  ]);
  const downloaded = await download.path();

  if (downloaded === null) {
    throw new Error('the download has no path');
  }

  const file = join(tmpdir(), 'kiyora-offline-board.svg');
  await copyFile(downloaded, file);

  const opened = await context.newPage();
  await opened.goto(`file://${file}`);

  const figure = opened.locator('path').first();
  await expect(figure).not.toHaveAttribute('fill', 'none');

  const drawn = await figure.boundingBox();
  expect(drawn?.width ?? 0).toBeGreaterThan(0);
  expect(drawn?.height ?? 0).toBeGreaterThan(0);
});
