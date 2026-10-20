import { copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

test('the editor works with every non-localhost request aborted', async ({
  page,
}) => {
  const blocked: string[] = [];

  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    if (LOCAL_HOSTS.has(hostname)) {
      return route.continue();
    }
    blocked.push(route.request().url());
    return route.abort();
  });

  await page.goto('/');

  await expect(
    page.getByTestId('canvas').locator('path').first()
  ).toHaveAttribute('fill', '#2f9e44');

  expect(blocked).toEqual([]);
});

test('the exported board opens as a file with the network off, and shows the board', async ({
  context,
  page,
}) => {
  const blocked: string[] = [];

  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (LOCAL_HOSTS.has(new URL(url).hostname) || url.startsWith('file:')) {
      return route.continue();
    }
    blocked.push(url);
    return route.abort();
  });

  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

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
  expect(blocked).toEqual([]);
});
