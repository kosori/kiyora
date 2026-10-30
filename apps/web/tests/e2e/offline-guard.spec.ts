import { openStarterBoard } from '../fixtures/library';
import { expect, test } from '../fixtures/offline';

/**
 * The canary for the shared offline guard. It runs in `local-api` mode on
 * purpose: that mode blocks without failing, which is the only way to assert on
 * the guard's own collector without leaving a test that always fails. A request
 * that leaves the machine must be aborted and recorded, and the app must still
 * paint afterwards.
 */
test.describe('the offline guard', () => {
  test.use({ offlineMode: 'local-api' });

  test('aborts a third-party request and records it', async ({
    page,
    blockedRequests,
  }) => {
    await openStarterBoard(page);

    const thirdParty = 'https://example.com/kiyora-canary';
    const api = new URL('/api/kiyora-canary', page.url()).href;

    const outcomes = await page.evaluate(
      (urls) => {
        const attempt = async (url: string) => {
          try {
            await fetch(url);
            return 'resolved';
          } catch {
            return 'rejected';
          }
        };

        return Promise.all(urls.map(attempt));
      },
      [thirdParty, api]
    );

    expect(outcomes).toEqual(['rejected', 'rejected']);
    expect(blockedRequests).toContain(thirdParty);
    expect(blockedRequests).toContain(api);
  });
});
