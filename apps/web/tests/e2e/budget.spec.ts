import { expect, type Page, test } from '../fixtures/offline';

/**
 * The payload and first-paint budget.
 *
 * What it measures, and why these numbers:
 *
 * - The JavaScript is the byte total of every script the editor route hands the
 *   browser before it is interactive, read from the page's own Resource Timing
 *   buffer (`encodedBodySize`, the transferred size) rather than from a build
 *   report. The end-to-end harness serves a development build, so the total
 *   covers the app, the framework and the dev tooling together; a production
 *   build is smaller. The ceiling leaves roughly three times the observed
 *   development total as headroom — generous enough that a slow machine does
 *   not fail it, tight enough that adding a heavy dependency cannot pass
 *   unnoticed.
 * - First contentful paint is the first moment the server-rendered board is on
 *   screen, straight from the Paint Timing API. It is measured on a warm route,
 *   the way a returning person sees it: the global setup has already made the
 *   first, cold request, so this is not the compilation of the app.
 *
 * A regression in either should fail here rather than be discovered by a person
 * waiting for the editor to open.
 */

/** The most JavaScript the editor may load before it is interactive. */
export const SCRIPT_BUDGET_BYTES = 4 * 1024 * 1024;

/** The most waiting one may do for the first paint, in milliseconds. */
export const FIRST_PAINT_BUDGET_MS = 4000;

/** The JavaScript the page loaded, from its own timing buffer, in bytes. */
const scriptBytes = (page: Page): Promise<number> =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter(
        (entry) =>
          (entry as PerformanceResourceTiming).initiatorType === 'script' ||
          /\.m?js(\?|$)/.test(entry.name)
      )
      .reduce(
        (total, entry) =>
          total + (entry as PerformanceResourceTiming).encodedBodySize,
        0
      )
  );

/** When the board first painted content, in milliseconds, or `Infinity` if it never did. */
const firstPaintMs = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const paint = performance.getEntriesByType('paint');
    const first =
      paint.find((entry) => entry.name === 'first-contentful-paint') ??
      paint.find((entry) => entry.name === 'first-paint');

    return first?.startTime ?? Number.POSITIVE_INFINITY;
  });

test('the editor loads within its JavaScript and first-paint budget', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toHaveAttribute(
    'data-ready',
    'true'
  );

  const bytes = await scriptBytes(page);
  const paint = await firstPaintMs(page);

  expect(
    bytes,
    `the editor loaded ${bytes} bytes of JavaScript, over the ${SCRIPT_BUDGET_BYTES}-byte budget`
  ).toBeLessThanOrEqual(SCRIPT_BUDGET_BYTES);

  expect(
    paint,
    `the editor painted content after ${paint}ms, over the ${FIRST_PAINT_BUDGET_MS}ms budget`
  ).toBeLessThanOrEqual(FIRST_PAINT_BUDGET_MS);

  expect(bytes).toBeGreaterThan(0);
  expect(paint).toBeGreaterThan(0);
});
