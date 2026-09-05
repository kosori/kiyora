import { describe, expect, test } from 'bun:test';
import type { Scene } from '@kiyora/render';
import { downloadSvg, SVG_MIME_TYPE, svgFilename } from './io';

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

describe('svgFilename', () => {
	test('slugifies a Diagram title into a stable base name with .svg', () => {
		expect(svgFilename('Cache Server')).toBe('cache-server.svg');
		expect(svgFilename('Request pipeline')).toBe('request-pipeline.svg');
	});

	test('uses the fallback when the title is empty or whitespace', () => {
		expect(svgFilename('')).toBe('diagram.svg');
		expect(svgFilename('   ')).toBe('diagram.svg');
	});

	test('uses the DSL slug fallback for non-empty titles that produce no word', () => {
		expect(svgFilename('!!!')).toBe('node.svg');
	});
});

describe('downloadSvg', () => {
	test('downloads a self-contained SVG with the title-based filename and SVG MIME type', async () => {
		const { downloadable, recorded } = makeRecording();
		const fonts = {
			bold: { bytes: new Uint8Array([4, 5, 6]), mimeType: 'font/woff2' },
			regular: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'font/woff2' },
		};

		downloadSvg({
			downloadable,
			fonts,
			scene: SCENE,
			title: 'Request pipeline',
		});

		expect(recorded).toHaveLength(1);
		const [entry] = recorded;
		expect(entry?.filename).toBe('request-pipeline.svg');
		expect(entry?.blob.type).toBe(SVG_MIME_TYPE);
		const text = await entry?.blob.text();
		expect(text).toContain('<svg');
	});

	test('produces the canonical Scene projection: no grid, background, selection, or Viewport transform', async () => {
		const { downloadable, recorded } = makeRecording();
		const fonts = {
			bold: { bytes: new Uint8Array([4, 5, 6]), mimeType: 'font/woff2' },
			regular: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'font/woff2' },
		};

		downloadSvg({ downloadable, fonts, scene: SCENE, title: 'X' });

		const [entry] = recorded;
		const text = await entry?.blob.text();
		// The renderer does not emit a grid, background, or selection
		// artifact, so the projection must contain none of those markers.
		expect(text).not.toContain('grid');
		expect(text).not.toContain('selection');
		// The product canvas enables wobble, but SVG export stays clean.
		expect(text).not.toContain('data-wobble');
	});

	test('embeds the regular and bold font faces as data-URI @font-face rules', async () => {
		const { downloadable, recorded } = makeRecording();
		const regular = new Uint8Array([10, 20, 30]);
		const bold = new Uint8Array([40, 50, 60]);
		const fonts = {
			bold: { bytes: bold, mimeType: 'font/woff2' },
			regular: { bytes: regular, mimeType: 'font/woff2' },
		};

		downloadSvg({ downloadable, fonts, scene: SCENE, title: 'Embedded' });

		const [entry] = recorded;
		const text = await entry?.blob.text();
		// The base64 of [10, 20, 30] is "ChQe", and [40, 50, 60] is "KDI8".
		expect(text).toContain('data:font/woff2;base64,ChQe');
		expect(text).toContain('data:font/woff2;base64,KDI8');
		expect(text).toContain("font-family:'Balsamiq Sans Neue'");
		expect(text).toContain('font-weight:400');
		expect(text).toContain('font-weight:700');
	});

	test('falls back to the diagram filename when the title is unusable', () => {
		const { downloadable, recorded } = makeRecording();
		const fonts = {
			bold: { bytes: new Uint8Array([2]), mimeType: 'font/woff2' },
			regular: { bytes: new Uint8Array([1]), mimeType: 'font/woff2' },
		};

		downloadSvg({ downloadable, fonts, scene: SCENE, title: '' });

		expect(recorded[0]?.filename).toBe('diagram.svg');
	});

	test('embeds an SVG that includes the rendered Scene content', async () => {
		const { downloadable, recorded } = makeRecording();
		const fonts = {
			bold: { bytes: new Uint8Array([2]), mimeType: 'font/woff2' },
			regular: { bytes: new Uint8Array([1]), mimeType: 'font/woff2' },
		};

		downloadSvg({
			downloadable,
			fonts,
			scene: SCENE,
			title: 'Request pipeline',
		});

		const [entry] = recorded;
		const text = await entry?.blob.text();
		expect(text).toContain('data-node="a"');
	});
});
