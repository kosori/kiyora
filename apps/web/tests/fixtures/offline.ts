import { test as base } from '@playwright/test';

export type {
  BrowserContext,
  Locator,
  Page,
  TestInfo,
} from '@playwright/test';

export const { expect } = base;

/** How much of the network the offline guard leaves reachable. */
export type OfflineMode = 'third-party' | 'local-api' | 'none';

type OfflineFixtures = {
  /** Every URL the guard aborted, in the order it saw them. */
  blockedRequests: string[];
  offlineMode: OfflineMode;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const isLocal = (url: URL): boolean => {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return true;
  }

  return LOCAL_HOSTS.has(url.hostname);
};

const isApi = (resourceType: string): boolean =>
  resourceType === 'fetch' || resourceType === 'xhr';

/**
 * The offline guard every spec inherits: it aborts requests that leave the
 * machine, and in `local-api` mode the app's own `fetch`/`xhr` calls too. A
 * spec that talks to a network double opts out with `offlineMode: 'none'`, per
 * test. `blockedRequests` is auto, so no spec can forget to install it.
 */
export const test = base.extend<OfflineFixtures>({
  blockedRequests: [
    async ({ context, offlineMode }, use) => {
      const blocked: string[] = [];

      if (offlineMode !== 'none') {
        await context.route('**/*', (route) => {
          const request = route.request();
          const thirdParty = !isLocal(new URL(request.url()));
          const localApi =
            offlineMode === 'local-api' && isApi(request.resourceType());

          if (thirdParty || localApi) {
            blocked.push(request.url());
            return route.abort();
          }

          return route.continue();
        });
      }

      await use(blocked);

      if (offlineMode === 'third-party') {
        expect(
          blocked,
          `the offline guard aborted ${blocked.join(', ')}`
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
  offlineMode: ['third-party', { option: true }],
});
