import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	fullyParallel: true,
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	reporter: 'html',
	retries: process.env.CI ? 2 : 0,
	testDir: './tests',
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'on-first-retry',
	},
	webServer: {
		command: 'bun run dev',
		env: {
			PORTLESS: '0',
		},
		reuseExistingServer: !process.env.CI,
		url: 'http://localhost:3000',
	},
	workers: process.env.CI ? 1 : undefined,
});
