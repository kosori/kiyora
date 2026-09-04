import { describe, expect, test } from 'bun:test';
import { browserFontReadiness, type ExportFonts } from './io';

type FakeBrowser = {
	calls: string[];
	restore: () => void;
};

const g = globalThis as unknown as Record<string, unknown>;

function installFakeBrowser(): FakeBrowser {
	const previousDocument = g.document;
	const previousFetch = g.fetch;
	const calls: string[] = [];
	g.document = {
		fonts: {
			load: (_font: string) => Promise.resolve([]),
			ready: Promise.resolve(),
		},
	};
	g.fetch = (input: string | URL) => {
		calls.push(String(input));
		return Promise.resolve({
			arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3])),
			ok: true,
		});
	};
	return {
		calls,
		restore: () => {
			g.document = previousDocument;
			g.fetch = previousFetch;
		},
	};
}

describe('browserFontReadiness', () => {
	test('constructing on the server does not throw or reject', async () => {
		const browser = installFakeBrowser();
		browser.restore();
		const previousDocument = g.document;
		g.document = undefined;
		try {
			const readiness = browserFontReadiness();
			expect(readiness.ready).toBeInstanceOf(Promise);

			let rejected = false;
			readiness.ready.catch(() => {
				rejected = true;
			});
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(rejected).toBe(false);
		} finally {
			g.document = previousDocument;
		}
	});

	test('does not fetch or touch the FontFaceSet until start is called', async () => {
		const browser = installFakeBrowser();
		try {
			const readiness = browserFontReadiness();
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(browser.calls).toHaveLength(0);

			readiness.start();
			const fonts = await readiness.ready;
			expect(browser.calls).toEqual([
				'/fonts/balsamiq-sans-neue-regular.woff2',
				'/fonts/balsamiq-sans-neue-bold.woff2',
			]);
			expect(fonts).toBeDefined();
		} finally {
			browser.restore();
		}
	});

	test('resolves with both woff2 faces after start', async () => {
		const browser = installFakeBrowser();
		try {
			const readiness = browserFontReadiness();
			readiness.start();
			const fonts: ExportFonts = await readiness.ready;
			expect(fonts.regular.mimeType).toBe('font/woff2');
			expect(fonts.bold.mimeType).toBe('font/woff2');
			expect(fonts.regular.bytes.length).toBe(3);
		} finally {
			browser.restore();
		}
	});

	test('start is idempotent', async () => {
		const browser = installFakeBrowser();
		try {
			const readiness = browserFontReadiness();
			readiness.start();
			readiness.start();
			await readiness.ready;
			expect(browser.calls).toHaveLength(2);
		} finally {
			browser.restore();
		}
	});
});
