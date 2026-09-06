import { describe, expect, test } from 'bun:test';
import type { Scene } from '@kiyora/render';
import { sceneNode } from '@kiyora/render/testing';
import { createEditor } from './editor';
import { renderScene } from './renderer';
import { RESIZE_HANDLES } from './resize';

const span = {
	end: { column: 1, line: 1 },
	start: { column: 1, line: 1 },
};

function makeScene(): Scene {
	return {
		edges: [
			{
				color: 'red',
				dashed: true,
				from: 'source',
				head: 'arrow',
				label: 'go',
				span,
				to: 'target',
			},
		],
		groups: [{ id: 'group', label: 'Group', span }],
		legend: [{ label: 'Ready', swatch: 'green' }],
		nodes: [
			sceneNode({
				color: 'blue',
				fill: 'pastel',
				group: 'group',
				height: 44,
				id: 'source',
				label: 'Source',
				span,
				width: 72,
				x: 50,
				y: 60,
			}),
			sceneNode({
				color: 'green',
				fill: 'bold',
				height: 44,
				id: 'target',
				label: 'Target',
				span,
				width: 72,
				x: 194,
				y: 60,
			}),
		],
		title: 'Canvas',
	};
}

describe('renderScene', () => {
	test('renders the complete scene under the camera and preserves render geometry', () => {
		const editor = createEditor(makeScene());
		const svg = renderScene(editor.getSnapshot(), {
			height: 240,
			showGrid: false,
			width: 360,
		});

		expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
		expect(svg).toContain('width="360" height="240" viewBox="0 0 360 240"');
		expect(svg).toContain(
			'<g transform="translate(4 24) scale(1)" font-family="\'Balsamiq Sans Neue\', cursive">'
		);
		expect(svg).toContain('data-group="group"');
		expect(svg).toContain('data-edge="source-target"');
		expect(svg).toContain('data-node="source"');
		expect(svg).toContain('data-node="target"');
		expect(svg).toContain('data-legend="true"');
		expect(svg).toContain('Canvas');
		expect(svg).toContain('stroke-dasharray="4.5 6"');
		expect(svg).toContain('fill="#a5d8ff"');
		expect(svg).not.toContain('fill="#c8cdd4"');
	});

	test('draws a viewport-aligned grid and zoom-invariant selection chrome', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 10, ty: -8, zoom: 2 });
		editor.select('source');
		const svg = renderScene(editor.getSnapshot(), {
			height: 100,
			width: 160,
		});

		expect(svg).toContain('<rect width="160" height="100" fill="#fbfcfe"/>');
		// Grid anchor is the world origin (10, -8); dots below y=0 are clipped,
		// so the first visible column starts at cy=40 (-8 + 48).
		expect(svg).toContain('cx="10" cy="40" r="1.2" fill="#c8cdd4"');
		expect(svg).toContain('transform="translate(10 -8) scale(2)"');
		expect(svg).toContain(
			'stroke="#4dabf7" stroke-width="1.5" stroke-dasharray="4 3"'
		);
		expect(svg).toContain('x="107" y="109" width="150" height="94"');
	});

	test('can omit the grid without omitting the background', () => {
		const editor = createEditor(makeScene());
		const svg = renderScene(editor.getSnapshot(), {
			showGrid: false,
			wobble: true,
		});

		expect(svg).toContain('<rect width="294" height="212" fill="#fbfcfe"/>');
		expect(svg).not.toContain('fill="#c8cdd4"');
		expect(svg).toMatchSnapshot();
	});

	test('locks the complete projection as a golden SVG', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 12, ty: 18, zoom: 1.25 });
		editor.select('target');

		expect(
			renderScene(editor.getSnapshot(), {
				height: 240,
				width: 360,
				wobble: true,
			})
		).toMatchSnapshot();
	});

	test('renders a rotated node with a per-node transform while chrome stays axis-aligned', () => {
		const editor = createEditor(makeScene());
		const rotated = sceneNode({
			height: 44,
			id: 'tilted',
			label: 'Tilted',
			rotation: 45,
			span,
			width: 72,
			x: 300,
			y: 60,
		});
		editor.setScene({
			...editor.getScene(),
			nodes: [...editor.getScene().nodes, rotated],
		});
		editor.select('tilted');
		const svg = renderScene(editor.getSnapshot(), {
			height: 240,
			showGrid: false,
			width: 480,
		});

		expect(svg).toContain(
			'<g data-node="tilted" transform="rotate(45 336 82)">'
		);
		const selectedOutline = svg.match(
			/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" rx="[^"]*" fill="none" stroke="#4dabf7"[^>]*\/>/
		)?.[0];
		expect(selectedOutline).toBeDefined();
		expect(selectedOutline).not.toContain('transform');
	});

	test('draws an active marquee rectangle in screen space above the scene', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.beginMarquee({ x: 10, y: 20 });
		editor.marqueeTo({ x: 60, y: 40 });

		const svg = renderScene(editor.getSnapshot(), {
			height: 240,
			showGrid: false,
			width: 360,
		});

		expect(svg).toContain(
			'<rect x="10" y="20" width="50" height="20" fill="rgba(77,171,247,0.12)" stroke="#4dabf7" stroke-width="1"/>'
		);
	});

	test('draws eight resize handles on a selected node and none otherwise', () => {
		const scene: Scene = {
			edges: [],
			groups: [],
			nodes: [
				sceneNode({
					height: 40,
					id: 'box',
					label: 'Box',
					span,
					width: 80,
					x: 100,
					y: 100,
				}),
			],
			title: '',
		};
		const editor = createEditor(scene);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });

		const before = renderScene(editor.getSnapshot(), {
			height: 300,
			showGrid: false,
			width: 400,
		});
		for (const handle of RESIZE_HANDLES) {
			expect(before).not.toContain(`data-resize-handle="${handle}"`);
		}

		editor.select('box');
		const after = renderScene(editor.getSnapshot(), {
			height: 300,
			showGrid: false,
			width: 400,
		});
		for (const handle of RESIZE_HANDLES) {
			expect(after).toContain(`data-resize-handle="${handle}"`);
		}
		expect(after.match(/data-resize-handle=/gu)).toHaveLength(8);
		expect(
			after.match(/data-resize-handle="[^"]*" aria-hidden="true"/gu)
		).toHaveLength(8);
		// Handles sit on the selection outline of the 80x40 box at (100,100):
		// nw centered (97,97), se centered (183,143), each an 8px square.
		expect(after).toContain(
			'<rect data-resize-handle="nw" aria-hidden="true" x="93" y="93" width="8" height="8"'
		);
		expect(after).toContain(
			'<rect data-resize-handle="se" aria-hidden="true" x="179" y="139" width="8" height="8"'
		);
	});

	test('omits resize handles when the scene is read-only', () => {
		const scene: Scene = {
			edges: [],
			groups: [],
			nodes: [
				sceneNode({
					height: 40,
					id: 'box',
					label: 'Box',
					span,
					width: 80,
					x: 100,
					y: 100,
				}),
			],
			readOnly: true,
			title: '',
		};
		const editor = createEditor(scene);
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('box');

		const svg = renderScene(editor.getSnapshot(), {
			height: 300,
			showGrid: false,
			width: 400,
		});

		for (const handle of RESIZE_HANDLES) {
			expect(svg).not.toContain(`data-resize-handle="${handle}"`);
		}
	});

	test('edges re-route to the resized bounds of an endpoint node', () => {
		const source = sceneNode({
			height: 40,
			id: 'a',
			label: 'A',
			span,
			width: 80,
			x: 0,
			y: 0,
		});
		const target = sceneNode({
			height: 40,
			id: 'b',
			label: 'B',
			span,
			width: 80,
			x: 200,
			y: 0,
		});
		const editor = createEditor({
			edges: [{ from: 'a', span, to: 'b' }],
			groups: [],
			nodes: [source, target],
			title: '',
		});
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		const before = renderScene(editor.getSnapshot(), { showGrid: false });
		expect(before).toContain('d="M 80 20 C 128 20, 152 20, 200 20"');

		editor.beginResize('a', 'e');
		editor.resizeTo({ x: 120, y: 20 });
		editor.endResize();
		const after = renderScene(editor.getSnapshot(), { showGrid: false });

		expect(after).toContain('d="M 120 20 C 152 20, 168 20, 200 20"');
	});

	test('renders no marquee rectangle when none is active', () => {
		const editor = createEditor(makeScene());
		const before = renderScene(editor.getSnapshot(), {
			showGrid: false,
		});

		editor.beginMarquee({ x: 10, y: 20 });
		editor.marqueeTo({ x: 60, y: 40 });
		editor.endMarquee(false);
		const after = renderScene(editor.getSnapshot(), {
			showGrid: false,
		});

		expect(before).not.toContain('rgba(77,171,247,0.12)');
		expect(after).not.toContain('rgba(77,171,247,0.12)');
	});

	test('renders an explicit rotation of 0 without any transform', () => {
		const editor = createEditor(makeScene());
		const svg = renderScene(editor.getSnapshot(), {
			showGrid: false,
		});

		expect(svg).toContain('<g data-node="source">');
		expect(svg).not.toContain('rotate(');
	});

	function gridDots(zoom: number): [number, number][] {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 0, ty: 0, zoom });
		const svg = renderScene(editor.getSnapshot(), {
			height: 120,
			width: 120,
		});
		return [
			...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)"[^/]*#c8cdd4/g),
		].map((match) => [Number(match[1]), Number(match[2])]);
	}
	function hasDot(dots: [number, number][], x: number, y: number): boolean {
		return dots.some(
			([cx, cy]) => Math.abs(cx - x) < 0.01 && Math.abs(cy - y) < 0.01
		);
	}

	function evenGridIndex(value: number): number {
		return (Math.round(value) % 2) + 0;
	}

	test('renders every grid dot at or above 65% zoom', () => {
		expect(gridDots(1)).toEqual(
			expect.arrayContaining([
				[0, 0],
				[24, 0],
				[48, 0],
			])
		);
		expect(gridDots(0.65)).toEqual(expect.arrayContaining([[0, 0]]));
	});

	test('renders every second dot below 65% down to 35%', () => {
		const dots = gridDots(0.5);
		expect(hasDot(dots, 0, 0)).toBe(true);
		expect(hasDot(dots, 24, 0)).toBe(true);
		expect(hasDot(dots, 12, 0)).toBe(false);
		// Just below the 65% boundary the 2nd-dot tier is active: gap 15.36,
		// so the odd-index position is skipped while i=2 stays.
		const justBelow = gridDots(0.64);
		expect(hasDot(justBelow, 15.36, 0)).toBe(false);
		expect(hasDot(justBelow, 30.72, 0)).toBe(true);
		// At exactly 35% the 2nd-dot tier still applies.
		const atBoundary = gridDots(0.35);
		expect(hasDot(atBoundary, 0, 0)).toBe(true);
		expect(hasDot(atBoundary, 16.8, 0)).toBe(true);
		expect(hasDot(atBoundary, 8.4, 0)).toBe(false);
	});

	test('renders every fourth dot below 35% down to 15%', () => {
		const dots = gridDots(0.2);
		expect(hasDot(dots, 0, 0)).toBe(true);
		expect(hasDot(dots, 19.2, 0)).toBe(true);
		expect(hasDot(dots, 4.8, 0)).toBe(false);
		expect(hasDot(dots, 9.6, 0)).toBe(false);
		// At exactly 15% the 4th-dot tier still applies: gap 3.6, kept every
		// 4th index, so 3.6 (i=1) is skipped and 14.4 (i=4) stays.
		const atBoundary = gridDots(0.15);
		expect(hasDot(atBoundary, 3.6, 0)).toBe(false);
		expect(hasDot(atBoundary, 14.4, 0)).toBe(true);
	});

	test('renders every eighth dot below 15%', () => {
		const dots = gridDots(0.125);
		expect(hasDot(dots, 0, 0)).toBe(true);
		expect(hasDot(dots, 24, 0)).toBe(true);
		expect(hasDot(dots, 3, 0)).toBe(false);
		// Just below 15%: gap 3.36, so i=1 (3.36) is skipped and i=8 (26.88)
		// is the first kept neighbor.
		const justBelow = gridDots(0.14);
		expect(hasDot(justBelow, 3.36, 0)).toBe(false);
		expect(hasDot(justBelow, 26.88, 0)).toBe(true);
	});

	test('keeps the thinned grid anchored to the world origin under arbitrary pan', () => {
		const editor = createEditor(makeScene());
		// gap = 12, step 2: kept dots sit every 24 screen px from the panned
		// world-origin position, not from the viewport's top-left.
		editor.setViewport({ tx: 7, ty: -3, zoom: 0.5 });
		const svg = renderScene(editor.getSnapshot(), {
			height: 120,
			width: 120,
		});
		const dots: [number, number][] = [
			...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)"[^/]*#c8cdd4/g),
		].map((match) => [Number(match[1]), Number(match[2])]);

		expect(dots.length).toBeGreaterThan(0);
		for (const [x, y] of dots) {
			expect(evenGridIndex((x - 7) / 12)).toBe(0);
			expect(evenGridIndex((y + 3) / 12)).toBe(0);
		}
		expect(hasDot(dots, 19, 9)).toBe(false);
		expect(hasDot(dots, 7, 21)).toBe(true);
	});

	test('bounds the dot count when zoomed far out', () => {
		// Unthinned, a 120px canvas at 10% zoom (2.4px gap) would emit ~2500
		// circles. The eighth-dot tier keeps the count low so zoom-out stays
		// performant.
		expect(gridDots(0.1).length).toBeLessThan(100);
	});

	test('renders no dots below 10% zoom but keeps the background', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 0, ty: 0, zoom: 0.05 });
		const svg = renderScene(editor.getSnapshot(), {
			height: 120,
			width: 120,
		});

		expect(gridDots(0.09)).toHaveLength(0);
		expect(gridDots(0.05)).toHaveLength(0);
		expect(svg).toContain('<rect width="120" height="120" fill="#fbfcfe"/>');
		expect(svg).not.toContain('fill="#c8cdd4"');
	});

	test('keeps the eighth-dot tier at exactly 10% zoom', () => {
		const dots = gridDots(0.1);
		expect(hasDot(dots, 0, 0)).toBe(true);
		expect(hasDot(dots, 2.4, 0)).toBe(false);
		expect(hasDot(dots, 19.2, 0)).toBe(true);
	});

	function overlayPaths(svg: string): string[] {
		return [...svg.matchAll(/data-wobble="true"[^>]*d="([^"]+)"/gu)].map(
			(match) => match[1] ?? ''
		);
	}

	test('stays clean by default and renders overlays only when wobble is requested', () => {
		const editor = createEditor(makeScene());
		const clean = renderScene(editor.getSnapshot(), {
			showGrid: false,
		});
		expect(clean).not.toContain('data-wobble');

		const wobbled = renderScene(editor.getSnapshot(), {
			showGrid: false,
			wobble: true,
		});
		expect(overlayPaths(wobbled).length).toBeGreaterThan(0);
	});

	test('keeps wobble overlays identical across repeated renders and viewport changes', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		const base = renderScene(editor.getSnapshot(), {
			height: 240,
			showGrid: false,
			width: 360,
			wobble: true,
		});
		const repeat = renderScene(editor.getSnapshot(), {
			height: 240,
			showGrid: false,
			width: 360,
			wobble: true,
		});
		expect(overlayPaths(base).length).toBeGreaterThan(0);
		expect(repeat).toBe(base);

		editor.setViewport({ tx: -140, ty: 60, zoom: 2.5 });
		const panned = renderScene(editor.getSnapshot(), {
			height: 240,
			showGrid: false,
			width: 360,
			wobble: true,
		});
		expect(overlayPaths(panned)).toEqual(overlayPaths(base));
		expect(panned).toContain('transform="translate(-140 60) scale(2.5)"');
	});

	test('keeps selection and resize chrome wobble-free over clean geometry', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('source');
		const svg = renderScene(editor.getSnapshot(), {
			height: 240,
			showGrid: false,
			width: 360,
			wobble: true,
		});

		const selection = svg.match(
			/<rect[^>]*stroke="#4dabf7"[^>]*stroke-dasharray="4 3"[^>]*\/>/u
		)?.[0];
		expect(selection).toBeDefined();
		expect(selection).not.toContain('data-wobble');
		expect(svg.match(/data-resize-handle=[^>]*data-wobble/gu)).toBeNull();
		expect(svg.match(/data-wobble[^>]*#4dabf7/gu)).toBeNull();
	});

	test('enables hand-drawn wobble overlays on every scene element', () => {
		const editor = createEditor(makeScene());
		const svg = renderScene(editor.getSnapshot(), {
			showGrid: false,
			wobble: true,
		});

		const elementGroups = [
			['group', /<g data-group="group">([\s\S]*?)<\/g>/u],
			['edge', /<g data-edge="source-target">([\s\S]*?)<\/g>/u],
			['node source', /<g data-node="source">([\s\S]*?)<\/g>/u],
			['node target', /<g data-node="target">([\s\S]*?)<\/g>/u],
		] as const;
		for (const [label, pattern] of elementGroups) {
			const markup = svg.match(pattern)?.[1] ?? '';
			expect(
				[...markup.matchAll(/data-wobble="true"/gu)].length,
				label
			).toBeGreaterThanOrEqual(1);
		}
		for (const overlay of svg.matchAll(/<path data-wobble="true"[^>]*\/>/gu)) {
			expect(overlay[0]).toContain('pointer-events="none"');
		}
	});

	test('omits node labels below 20% zoom while other text stays', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 0, ty: 0, zoom: 0.15 });
		const svg = renderScene(editor.getSnapshot(), {
			height: 400,
			width: 600,
		});

		expect(svg).not.toContain('>Source</text>');
		expect(svg).not.toContain('>Target</text>');
		expect(svg).toContain('data-node="source"');
		expect(svg).toContain('data-edge="source-target"');
		expect(svg).toContain('>go</text>');
		expect(svg).toContain('Canvas');
		expect(svg).toContain('Ready');
	});

	test('keeps node labels visible at exactly 20% zoom', () => {
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 0, ty: 0, zoom: 0.2 });
		const svg = renderScene(editor.getSnapshot(), {
			height: 400,
			width: 600,
		});

		expect(svg).toContain('>Source</text>');
		expect(svg).toContain('>Target</text>');
	});
});
