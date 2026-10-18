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
