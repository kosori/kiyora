import { defineConfig, devices } from '@playwright/test';

const PORT = 4319;
const baseURL = `http://localhost:${PORT}`;

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
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `bun run dev --port ${PORT}`,
    cwd: './apps/web',
    reuseExistingServer: false,
    timeout: 180_000,
    url: baseURL,
  },
});
