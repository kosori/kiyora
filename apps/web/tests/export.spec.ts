import { statSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.describe('Canvas export paths', () => {
	for (const { action, extension, label } of [
		{ action: 'export-png', extension: 'png', label: 'Export PNG' },
		{ action: 'export-svg', extension: 'svg', label: 'Export SVG' },
	]) {
		test(`exports diagram as ${extension.toUpperCase()} with valid filename and non-zero size`, async ({
			page,
		}) => {
			await page.goto('/');
			await page.waitForLoadState('networkidle');

			const textarea = page.getByRole('textbox', { name: 'Kiyora Source' });
			await expect(textarea).toBeVisible();
			await textarea.fill('architecture\ntitle Export Test\n  a -> b\n');

			await page.locator('[data-file-menu-trigger="true"]').click();
			const exportButton = page.locator(`[data-file-action="${action}"]`);
			await expect(exportButton).toBeEnabled();
			await expect(exportButton).toHaveText(label);

			const downloadPromise = page.waitForEvent('download');
			await exportButton.click();
			const download = await downloadPromise;

			expect(download.suggestedFilename()).toBe(`export-test.${extension}`);
			const downloadPath = await download.path();
			expect(downloadPath).not.toBeNull();
			if (!downloadPath) {
				throw new Error('Expected download path to exist');
			}
			const stat = statSync(downloadPath);
			expect(stat.size).toBeGreaterThan(0);
		});
	}
});
