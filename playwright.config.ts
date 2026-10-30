import { defineConfig, devices } from '@playwright/test';
import {
  E2E_AUTH_ENV,
  E2E_BASE_URL,
  E2E_SERVER_COMMAND,
  E2E_SERVER_DB,
} from './apps/web/tests/e2e-server';

const environment = Object.fromEntries(
  Object.entries({ ...process.env, ...E2E_AUTH_ENV }).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  )
);

export default defineConfig({
  expect: { timeout: 5000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  globalSetup: './apps/web/tests/global-setup.ts',
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/server/**',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(E2E_SERVER_DB
      ? [
          {
            fullyParallel: false,
            name: 'server',
            testDir: './apps/web/tests/server',
            timeout: 60_000,
            use: { ...devices['Desktop Chrome'] },
          },
        ]
      : []),
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './apps/web/tests',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: E2E_SERVER_COMMAND,
    cwd: './apps/web',
    env: environment,
    reuseExistingServer: false,
    timeout: 180_000,
    url: E2E_BASE_URL,
  },
});
