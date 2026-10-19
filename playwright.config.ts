import { defineConfig, devices } from '@playwright/test';
import { E2E_BASE_URL, E2E_PORT } from './apps/web/tests/e2e-server';

export default defineConfig({
  expect: { timeout: 5000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  globalSetup: './apps/web/tests/global-setup.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './apps/web/tests',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `bun run dev --port ${E2E_PORT}`,
    cwd: './apps/web',
    reuseExistingServer: false,
    timeout: 180_000,
    url: E2E_BASE_URL,
  },
});
