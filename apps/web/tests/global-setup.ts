import { expect, request } from '@playwright/test';
import { BUILD_MARKER } from '../app/build-marker';

const BASE_URL = 'http://localhost:4319';

/**
 * The end-to-end run must prove which application it tested. This asserts the
 * served page carries this app's build marker, so a stray server answering on
 * the port fails loudly instead of passing silently.
 */
export default async () => {
  const context = await request.newContext({ baseURL: BASE_URL });
  const response = await context.get('/');

  expect(response.ok()).toBe(true);

  const html = await response.text();

  expect(html).toContain('name="kiyora-build"');
  expect(html).toContain(`content="${BUILD_MARKER}"`);

  await context.dispose();
};
