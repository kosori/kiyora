import { describe, expect, mock, test } from 'bun:test';
import type { Scene } from '@kiyora/render';
import { renderToSvg } from '@kiyora/render';
import {
	downloadPng,
	MAX_PNG_PIXELS_PER_DIM,
	MAX_PNG_PIXELS_TOTAL,
	PNG_DENSITY,
	PNG_MIME_TYPE,
	type PngRasterizer,
	pngFilename,
} from './io';

const span = { end: { column: 1, line: 1 }, start: { column: 1, line: 1 } };

const SCENE: Scene = {
	edges: [],
	groups: [],
	nodes: [
		{
			height: 44,
			id: 'a',
			label: 'A',
			rotation: 0,
			span,
			width: 72,
			x: 24,
			y: 24,
		},
	],
	title: 'Request pipeline',
};

const FONTS = {
	bold: { bytes: new Uint8Array([4, 5, 6]), mimeType: 'font/woff2' },
	regular: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'font/woff2' },
};

function makeRecording(): {
	downloadable: { save: (entry: { blob: Blob; filename: string }) => void };
	recorded: { blob: Blob; filename: string }[];
} {
	const recorded: { blob: Blob; filename: string }[] = [];
	return {
		downloadable: {
			save(entry) {
				recorded.push(entry);
			},
		},
		recorded,
	};
}

function makeRasterizer(
	blob: Blob = new Blob(['PNG'], { type: 'image/png' })
): { rasterizer: PngRasterizer; calls: { width: number; height: number }[] } {
	const calls: { width: number; height: number }[] = [];
	const rasterizer: PngRasterizer = {
		rasterize: mock(({ height, width }) => {
			calls.push({ height, width });
			return Promise.resolve(blob);
		}),
	};
	return { calls, rasterizer };
}

describe('pngFilename', () => {
	test('slugifies a Diagram title into a stable base name with .png', () => {
		expect(pngFilename('Cache Server')).toBe('cache-server.png');
		expect(pngFilename('Request pipeline')).toBe('request-pipeline.png');
	});

	test('uses the fallback when the title is empty or whitespace', () => {
		expect(pngFilename('')).toBe('diagram.png');
		expect(pngFilename('   ')).toBe('diagram.png');
	});

	test('uses the DSL slug fallback for non-empty titles that produce no word', () => {
		expect(pngFilename('!!!')).toBe('node.png');
	});
});

describe('PNG safety limits', () => {
	test('exports the constants that gate the rasterizer', () => {
		expect(MAX_PNG_PIXELS_PER_DIM).toBe(8192);
		expect(MAX_PNG_PIXELS_TOTAL).toBe(32_000_000);
	});
});

describe('downloadPng', () => {
	test('rasterizes the SVG at 2x and downloads a PNG with the title-based filename and PNG MIME type', async () => {
		const { downloadable, recorded } = makeRecording();
		const { rasterizer, calls } = makeRasterizer();

		await downloadPng({
			downloadable,
			fonts: FONTS,
			rasterizer,
			scene: SCENE,
			title: 'Request pipeline',
		});

		// The natural SVG dimensions come from the renderer; the
		// rasterizer must be asked for exactly 2x of those values so the
		// exported PNG is "sharp in ordinary use".
		const natural = renderToSvg(SCENE);
		expect(calls).toHaveLength(1);
		const [call] = calls;
		expect(call).toBeDefined();
		expect(call?.width).toBe(natural.width * PNG_DENSITY);
		expect(call?.height).toBe(natural.height * PNG_DENSITY);

		expect(recorded).toHaveLength(1);
		const [entry] = recorded;
		expect(entry?.filename).toBe('request-pipeline.png');
		expect(entry?.blob.type).toBe(PNG_MIME_TYPE);
	});

	test('embeds the same fonts as the SVG so the rasterized PNG renders outside the app', async () => {
		const { downloadable, recorded } = makeRecording();
		// Capture what the rasterizer was handed so we can verify the
		// typography is embedded before rasterization.
		let rasterizedSvg = '';
		const rasterizer: PngRasterizer = {
			rasterize: ({ svg }) => {
				rasterizedSvg = svg;
				return Promise.resolve(new Blob(['PNG'], { type: 'image/png' }));
			},
		};

		await downloadPng({
			downloadable,
			fonts: FONTS,
			rasterizer,
			scene: SCENE,
			title: 'Embedded',
		});

		// The same data-URI @font-face rules SVG export emits must be
		// present in the SVG handed to the rasterizer. PNG derives from
		// the portable static SVG so the typography is preserved. The
		// base64 for [1, 2, 3] is "AQID" and [4, 5, 6] is "BAUG".
		expect(rasterizedSvg).toContain('data:font/woff2;base64,AQID');
		expect(rasterizedSvg).toContain('data:font/woff2;base64,BAUG');
		expect(rasterizedSvg).toContain("font-family:'Balsamiq Sans Neue'");
		expect(recorded).toHaveLength(1);
	});

	test('falls back to the diagram filename when the title is unusable', async () => {
		const { downloadable, recorded } = makeRecording();
		const { rasterizer } = makeRasterizer();

		await downloadPng({
			downloadable,
			fonts: FONTS,
			rasterizer,
			scene: SCENE,
			title: '',
		});

		expect(recorded[0]?.filename).toBe('diagram.png');
	});

	test('rejects PNG when the 2x output would exceed the per-dimension pixel limit', async () => {
		// Build a Scene whose renderer-natural dimensions at 2x exceed
		// 8192 in one axis. We do this by giving the renderer a wide
		// edge geometry that pushes the natural width past 4096.
		const wide: Scene = {
			edges: [],
			groups: [],
			nodes: [
				{
					height: 44,
					id: 'a',
					label: 'A',
					rotation: 0,
					span,
					width: 72,
					x: 24,
					y: 24,
				},
				{
					height: 44,
					id: 'b',
					label: 'B',
					rotation: 0,
					span,
					width: 72,
					x: 9000,
					y: 24,
				},
			],
			title: 'Wide',
		};
		const { downloadable, recorded } = makeRecording();
		const { rasterizer, calls } = makeRasterizer();

		await expect(
			downloadPng({
				downloadable,
				fonts: FONTS,
				rasterizer,
				scene: wide,
				title: 'Wide',
			})
		).rejects.toThrow(/too large/i);

		// No PNG produced, no download recorded.
		expect(calls).toHaveLength(0);
		expect(recorded).toHaveLength(0);
	});

	test('rejects PNG when the 2x output would exceed the total pixel budget', async () => {
		// Build a Scene whose natural dimensions at 2x are within the
		// per-dim ceiling but whose product would exceed the total
		// pixel budget.
		const tall: Scene = {
			edges: [],
			groups: [],
			nodes: [
				{
					height: 44,
					id: 'a',
					label: 'A',
					rotation: 0,
					span,
					width: 72,
					x: 24,
					y: 24,
				},
				{
					height: 44,
					id: 'b',
					label: 'B',
					rotation: 0,
					span,
					width: 72,
					x: 24,
					y: 8000,
				},
			],
			title: 'Tall',
		};
		const { downloadable, recorded } = makeRecording();
		const { rasterizer, calls } = makeRasterizer();

		await expect(
			downloadPng({
				downloadable,
				fonts: FONTS,
				rasterizer,
				scene: tall,
				title: 'Tall',
			})
		).rejects.toThrow(/too large/i);

		expect(calls).toHaveLength(0);
		expect(recorded).toHaveLength(0);
	});

	test('propagates rasterizer failures so the editor can surface them as a file error', async () => {
		const { downloadable, recorded } = makeRecording();
		const rasterizer: PngRasterizer = {
			rasterize: () => Promise.reject(new Error('canvas tainted')),
		};

		await expect(
			downloadPng({
				downloadable,
				fonts: FONTS,
				rasterizer,
				scene: SCENE,
				title: 'X',
			})
		).rejects.toThrow(/canvas tainted/);

		expect(recorded).toHaveLength(0);
	});

	test('downloads a PNG whose MIME type is image/png (transparent-ready)', async () => {
		const { downloadable, recorded } = makeRecording();
		const blob = new Blob(['PNG'], { type: 'image/png' });
		const { rasterizer } = makeRasterizer(blob);

		await downloadPng({
			downloadable,
			fonts: FONTS,
			rasterizer,
			scene: SCENE,
			title: 'Transparent',
		});

		expect(recorded[0]?.blob.type).toBe(PNG_MIME_TYPE);
	});

	test('hands the rasterizer an SVG without a painted background so a transparent-ready PNG can be produced', async () => {
		// The browser rasterizer clears the canvas before drawImage and
		// does not paint a background, so any tint in the PNG must come
		// from the SVG itself. The renderer never emits a background
		// <rect>, and `downloadPng` must not introduce one. Asserting on
		// the SVG handed to the rasterizer pins both halves of the
		// transparency path: a regression that adds a background fill
		// in either place is caught here, before the rasterizer hides
		// it.
		const { downloadable } = makeRecording();
		let handedToRasterizer = '';
		const rasterizer: PngRasterizer = {
			rasterize: ({ svg }) => {
				handedToRasterizer = svg;
				return Promise.resolve(new Blob(['PNG'], { type: 'image/png' }));
			},
		};

		await downloadPng({
			downloadable,
			fonts: FONTS,
			rasterizer,
			scene: SCENE,
			title: 'No background',
		});

		// The portable projection only draws nodes, edges, groups,
		// title, and legend — no background rect. The svg root has no
		// `style` background and no `fill` on the root <svg>.
		expect(handedToRasterizer).not.toMatch(/<rect[^>]*fill[^>]*background/i);
		expect(handedToRasterizer).not.toMatch(/<svg[^>]*style=[^>]*background/i);
	});

	test('hands the rasterizer the clean wobble-free projection so the PNG never carries the display-only layer', async () => {
		const { downloadable } = makeRecording();
		let handedToRasterizer = '';
		const rasterizer: PngRasterizer = {
			rasterize: ({ svg }) => {
				handedToRasterizer = svg;
				return Promise.resolve(new Blob(['PNG'], { type: 'image/png' }));
			},
		};

		await downloadPng({
			downloadable,
			fonts: FONTS,
			rasterizer,
			scene: SCENE,
			title: 'Clean contract',
		});

		// PNG derives from the same canonical static projection as SVG
		// export; embedding fonts only inserts a <style> block after the
		// opening <svg> tag, so the rest must be byte-identical to the
		// default (wobble-disabled) projection.
		expect(handedToRasterizer).not.toContain('data-wobble');
		const { svg: clean } = renderToSvg(SCENE);
		const withoutStyle = handedToRasterizer.replace(
			/<style>.*?<\/style>/su,
			''
		);
		expect(withoutStyle).toBe(clean);
	});
});
