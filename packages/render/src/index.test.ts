import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Diagram, parse, SHAPES, type Span } from '@kiyora/dsl';
import {
	compile,
	deriveGroupBoxes,
	render,
	renderSceneElements,
	renderToSvg,
	type Scene,
} from './index';
import { sceneNode } from './testing';

const span: Span = {
	end: { column: 1, line: 1 },
	start: { column: 1, line: 1 },
};

const diagram: Diagram = {
	edges: [],
	groups: [],
	kind: 'graph',
	nodes: [],
	title: '',
};

describe('render scaffold', () => {
	test('compiles any diagram to an empty scene', () => {
		expect(compile(diagram)).toEqual({
			edges: [],
			groups: [],
			nodes: [],
			title: '',
		});
	});

	test('preserves scene metadata', () => {
		const metadataDiagram: Diagram = {
			...diagram,
			direction: 'up',
			legend: [{ label: 'Ready', swatch: 'green' }],
		};

		expect(compile(metadataDiagram)).toEqual({
			direction: 'up',
			edges: [],
			groups: [],
			legend: [{ label: 'Ready', swatch: 'green' }],
			nodes: [],
			title: '',
		});
	});

	test('projects an empty scene to a valid SVG with default bounds', () => {
		const result = renderToSvg(compile(diagram));
		expect(result.width).toBe(48);
		expect(result.height).toBe(48);
		expect(result.svg).toStartWith(
			'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" font-family="\'Balsamiq Sans Neue\', cursive">'
		);
		expect(result.svg).toContain('<defs>');
		expect(result.svg).toContain('id="kiyora-arrow"');
	});

	test('renders shape, labels, and every supported edge style', () => {
		const scene: Scene = {
			edges: [
				{
					back: true,
					bidirectional: true,
					color: 'red',
					dashed: true,
					from: 'a',
					head: 'cross',
					label: '<go & return>',
					span,
					to: 'b',
				},
				{
					from: 'a',
					invisible: true,
					span,
					to: 'b',
				},
			],
			groups: [],
			legend: [{ label: 'Ready & safe', swatch: 'green' }],
			nodes: [
				sceneNode({
					color: 'blue',
					corner: 'sharp',
					fill: 'bold',
					height: 60,
					id: 'a',
					label: '<A & B>',
					labelColor: 'red',
					shadow: true,
					span,
					width: 100,
					x: 24,
					y: 24,
				}),
				sceneNode({
					height: 60,
					id: 'b',
					label: 'B',
					span,
					width: 100,
					x: 224,
					y: 24,
				}),
			],
			title: 'Title & details',
		};
		const result = renderToSvg(scene);
		expect(result.svg).toContain('<text x="24" y="42"');
		expect(result.svg).toContain('Title &amp; details');
		expect(result.svg).toContain('&lt;A &amp; B&gt;');
		expect(result.svg).toContain('&lt;go &amp; return&gt;');
		expect(result.svg).toContain('url(#kiyora-cross)');
		expect(result.svg).toContain('url(#kiyora-cross-reverse)');
		expect(result.svg).toContain('stroke-dasharray="4.5 6"');
		expect(result.svg).toContain('url(#kiyora-shadow)');
		expect(result.svg).toContain('data-legend="true"');
		expect(result.svg.match(/data-edge="a-b"/g)?.length).toBe(1);
	});

	test('draws a back edge with only its reverse-direction marker', () => {
		const result = renderToSvg({
			edges: [
				{
					back: true,
					from: 'target',
					head: 'arrow',
					span,
					to: 'source',
				},
			],
			groups: [],
			nodes: [
				sceneNode({
					height: 44,
					id: 'source',
					label: 'Source',
					span,
					width: 72,
					x: 24,
					y: 24,
				}),
				sceneNode({
					height: 44,
					id: 'target',
					label: 'Target',
					span,
					width: 72,
					x: 168,
					y: 24,
				}),
			],
			title: '',
		});

		expect(result.svg).toContain(
			'<path d="M 168 46 C 139.2 46, 124.8 46, 96 46" fill="none" stroke="#1e1e1e" stroke-width="2.5" stroke-linecap="round" marker-end="url(#kiyora-arrow)"/>'
		);
		expect(result.svg).not.toContain('marker-start=');
	});

	test('draws padded nested groups behind nodes and includes them in bounds', () => {
		const scene: Scene = {
			edges: [],
			groups: [
				{ id: 'parent', label: 'Parent', span },
				{ id: 'child', label: 'Child', parent: 'parent', span },
				{ id: 'empty', label: 'Empty', span },
			],
			nodes: [
				sceneNode({
					group: 'child',
					height: 40,
					id: 'a',
					label: 'A',
					span,
					width: 80,
					x: 50,
					y: 50,
				}),
			],
			title: '',
		};
		const result = renderToSvg(scene);
		expect(result.svg).toContain('data-group="parent"');
		expect(result.svg).toContain('data-group="child"');
		expect(result.svg).not.toContain('data-group="empty"');
		expect(result.svg.indexOf('data-group="parent"')).toBeLessThan(
			result.svg.indexOf('data-node="a"')
		);
		expect(result.width).toBe(248);
		expect(result.height).toBe(208);
	});

	test('renders wrapped labels from a parsed fixture without overflow', () => {
		const source = readFileSync(
			join(import.meta.dir, '..', 'test', 'fixtures', 'flowchart-wrapped.kira'),
			'utf8'
		);
		const scene = compile(parse(source).diagram);
		const result = renderToSvg(scene);
		expect(scene.nodes[0]?.label).toContain('deliberately long label');
		expect(result.svg.match(/<text /g)?.length).toBeGreaterThan(2);
		expect(result.svg).toContain('Frontend application');
		expect(result.svg).toContain('deliberately long');
	});

	test('locks a complete SVG golden projection', () => {
		const result = renderToSvg({
			edges: [
				{ from: 'source', head: 'arrow', label: 'go', span, to: 'target' },
			],
			groups: [],
			nodes: [
				sceneNode({
					color: 'blue',
					fill: 'pastel',
					height: 44,
					id: 'source',
					label: 'Source',
					span,
					width: 72,
					x: 24,
					y: 24,
				}),
				sceneNode({
					color: 'green',
					fill: 'bold',
					height: 44,
					id: 'target',
					label: 'Target',
					span,
					width: 72,
					x: 168,
					y: 24,
				}),
			],
			title: 'Golden',
		});
		expect(result.svg).toMatchSnapshot();
	});

	test('projects statemachine start and end shapes', () => {
		const result = render(parse('statemachine\nStart\nEnd').diagram);

		expect(result.svg).toContain('data-node="start"><circle');
		expect(result.svg).toContain('data-node="end"><circle');
		const endNode = result.svg.match(/<g data-node="end">([\s\S]*?)<\/g>/)?.[1];
		expect(endNode?.match(/<circle/g)?.length).toBe(2);
	});

	test('applies a per-node rotation transform around the node center', () => {
		const scene: Scene = {
			edges: [{ from: 'rotated', span, to: 'straight' }],
			groups: [],
			nodes: [
				sceneNode({
					height: 60,
					id: 'rotated',
					label: 'A',
					rotation: 45,
					width: 100,
					x: 24,
					y: 24,
				}),
				sceneNode({
					height: 60,
					id: 'straight',
					label: 'B',
					width: 100,
					x: 224,
					y: 24,
				}),
			],
			title: '',
		};
		const result = renderToSvg(scene);

		expect(result.svg).toContain(
			'<g data-node="rotated" transform="rotate(45 74 54)">'
		);
		expect(result.svg).toContain('<g data-node="straight">');
		const rotatedGroup = result.svg.match(
			/<g data-node="rotated"[\s\S]*?<\/g>/
		)?.[0];
		expect(rotatedGroup).toContain('>A</text>');
		expect(result.svg).toContain('data-edge="rotated-straight"');
	});

	test('renders an explicit rotation of 0 without any transform', () => {
		const result = renderToSvg({
			edges: [],
			groups: [],
			nodes: [
				sceneNode({
					color: 'blue',
					height: 44,
					id: 'source',
					label: 'Source',
					rotation: 0,
					span,
					width: 72,
					x: 24,
					y: 24,
				}),
			],
			title: '',
		});

		expect(result.svg).toContain('<g data-node="source">');
		expect(result.svg).not.toContain('rotate(');
	});

	test('sizes automatic bounds for chrome and sanitizes legend swatches', () => {
		const result = renderToSvg({
			edges: [],
			groups: [],
			legend: [
				{
					label: 'A very long legend label',
					swatch: '" onmouseover="alert(1)',
				},
			],
			nodes: [],
			title: 'A very long diagram title',
		});
		expect(result.width).toBeGreaterThan(48);
		expect(result.svg).toContain('fill="#1e1e1e"');
		expect(result.svg).not.toContain('onmouseover');
	});

	test('sizes compiled labels with a custom node font size', () => {
		const result = render(
			{
				edges: [],
				groups: [],
				kind: 'graph',
				nodes: [{ id: 'large', label: 'large label', span }],
				title: '',
			},
			{ nodeFontSize: 32 }
		);
		expect(result.svg).toContain('font-size="32"');
		expect(result.height).toBeGreaterThan(44);
		expect(result.width).toBeGreaterThan(72);
	});

	test('keeps node label markup in the default export projection', () => {
		const scene: Scene = {
			edges: [],
			groups: [],
			nodes: [
				sceneNode({
					height: 44,
					id: 'a',
					label: 'Node A',
					span,
					width: 72,
					x: 24,
					y: 24,
				}),
			],
			title: '',
		};
		expect(renderToSvg(scene).svg).toContain('>Node A</text>');
	});

	test('omits node label markup when showNodeLabels is false', () => {
		const scene: Scene = {
			edges: [{ from: 'a', label: 'edge label', span, to: 'b' }],
			groups: [{ id: 'g', label: 'Group label', span }],
			legend: [{ label: 'Legend label', swatch: 'green' }],
			nodes: [
				sceneNode({
					group: 'g',
					height: 60,
					id: 'a',
					label: 'Node A',
					span,
					width: 100,
					x: 24,
					y: 24,
				}),
				sceneNode({
					height: 60,
					id: 'b',
					label: 'Node B',
					span,
					width: 100,
					x: 224,
					y: 24,
				}),
			],
			title: 'Diagram title',
		};
		const hidden = renderToSvg(scene, { showNodeLabels: false });
		expect(hidden.svg).not.toContain('>Node A</text>');
		expect(hidden.svg).not.toContain('>Node B</text>');
		expect(hidden.svg).toContain('edge label');
		expect(hidden.svg).toContain('Group label');
		expect(hidden.svg).toContain('Legend label');
		expect(hidden.svg).toContain('Diagram title');
		expect(hidden.svg).toContain('data-node="a"');
	});

	describe('wobble projection', () => {
		const wobbleScene = (
			nodeOverrides: Partial<Parameters<typeof sceneNode>[0]> = {}
		): Scene => ({
			edges: [],
			groups: [],
			nodes: [
				sceneNode({
					height: 44,
					id: 'a',
					label: 'Node A',
					shape: 'rectangle',
					width: 100,
					x: 20,
					y: 30,
					...nodeOverrides,
				}),
			],
			title: '',
		});

		test('omits wobble overlays by default', () => {
			expect(renderToSvg(wobbleScene()).svg).not.toContain('data-wobble');
		});

		test('renders overlays only when explicitly enabled', () => {
			const { svg: clean } = renderToSvg(wobbleScene());
			const { svg: wobbled } = renderToSvg(wobbleScene(), { wobble: true });
			expect(wobbled).toContain('data-wobble="true"');
			expect(wobbled).toContain('pointer-events="none"');
			expect(wobbled).toContain('fill="#1e1e1e"');
			expect(clean).not.toContain('data-wobble');
		});

		test('keeps clean geometry and labels intact beneath overlays', () => {
			const { svg } = renderToSvg(wobbleScene(), { wobble: true });
			expect(svg).toContain('fill="#e9ecef"');
			expect(svg).toContain('stroke-width="2"');
			expect(svg).toContain('>Node A</text>');
			const [nodeGroup = ''] =
				svg.match(/<g data-node="a">([\s\S]*?)<\/g>/) ?? [];
			expect(nodeGroup).not.toBe('');
			const cleanIndex = nodeGroup.indexOf('fill-opacity="1"');
			const overlayIndex = nodeGroup.indexOf('data-wobble');
			expect(cleanIndex).toBeGreaterThanOrEqual(0);
			expect(overlayIndex).toBeGreaterThan(cleanIndex);
		});

		test('overlays text stays clean', () => {
			const { svg } = renderToSvg(wobbleScene(), { wobble: true });
			expect(svg.match(/<text/g)?.length).toBe(1);
		});

		test('places overlays inside the rotated node group', () => {
			const { svg } = renderToSvg(wobbleScene({ rotation: 45 }), {
				wobble: true,
			});
			const nodeGroup = svg.match(
				/<g data-node="a" transform="rotate\(45 70 52\)">([\s\S]*?)<\/g>/
			)?.[1];
			expect(nodeGroup).toContain('data-wobble="true"');
		});

		test('renders identical overlays for identical scenes', () => {
			const { svg: first } = renderToSvg(wobbleScene(), { wobble: true });
			const { svg: second } = renderToSvg(wobbleScene(), { wobble: true });
			expect(first).toBe(second);
		});

		test('distinct identities with identical geometry get distinct overlays', () => {
			const { svg: one } = renderToSvg(wobbleScene({ id: 'a' }), {
				wobble: true,
			});
			const { svg: other } = renderToSvg(wobbleScene({ id: 'b' }), {
				wobble: true,
			});
			const oneD = one.match(/data-wobble="true"[^/]*d="([^"]+)"/)?.[1];
			const otherD = other.match(/data-wobble="true"[^/]*d="([^"]+)"/)?.[1];
			expect(oneD).toBeDefined();
			expect(otherD).toBeDefined();
			expect(oneD).not.toBe(otherD);
		});

		test('moving and resizing regenerate the overlay deterministically', () => {
			const { svg: base } = renderToSvg(wobbleScene(), { wobble: true });
			const moved = renderToSvg(wobbleScene({ x: 24 }), {
				wobble: true,
			}).svg;
			const resized = renderToSvg(wobbleScene({ width: 140 }), {
				wobble: true,
			}).svg;
			expect(moved).not.toBe(base);
			expect(resized).not.toBe(base);
			expect(moved).toBe(
				renderToSvg(wobbleScene({ x: 24 }), { wobble: true }).svg
			);
		});

		test('gracefully omits overlays for degenerate geometry', () => {
			const { svg } = renderToSvg(wobbleScene({ height: 0, width: 0 }), {
				wobble: true,
			});
			expect(svg).toContain('data-node="a"');
			expect(svg).not.toContain('data-wobble');
		});

		test('interactive renderSceneElements options match the static seam', () => {
			const scene = wobbleScene();
			const without = renderSceneElements(scene, deriveGroupBoxes(scene), {});
			const withWobble = renderSceneElements(scene, deriveGroupBoxes(scene), {
				wobble: true,
			});
			expect(without).not.toContain('data-wobble');
			expect(withWobble).toContain('data-wobble');
		});

		const overlayCount = (svg: string, nodeId: string): number => {
			const nodeGroup = svg.match(
				new RegExp(`<g data-node="${nodeId}"[^>]*>([\\s\\S]*?)</g>`)
			)?.[1];
			return (nodeGroup?.match(/data-wobble="true"/g) ?? []).length;
		};

		test('every supported, fallback, and unknown shape gets at least one overlay', () => {
			const missing = [...SHAPES, 'future-shape'].filter((kind) => {
				const { svg } = renderToSvg(wobbleScene({ shape: kind }), {
					wobble: true,
				});
				return overlayCount(svg, 'a') < 1;
			});
			expect(missing).toEqual([]);
		});

		test('compound shapes wobble each component independently', () => {
			const expected: Record<string, number> = {
				actor: 5,
				card: 2,
				checkbox: 2,
				crossbox: 3,
				delay: 3,
				'double-circle': 2,
				plus: 2,
				'predefined-process': 3,
			};
			const actual: Record<string, number> = {};
			for (const kind of Object.keys(expected)) {
				const { svg } = renderToSvg(wobbleScene({ shape: kind }), {
					wobble: true,
				});
				const count = overlayCount(svg, 'a');
				if (count !== expected[kind]) {
					actual[kind] = count;
				}
			}
			expect(actual).toEqual({});
		});

		test('curve-based closed shapes produce dense wobble outlines', () => {
			const sparse: string[] = [];
			for (const kind of [
				'cloud',
				'document',
				'heart',
				'note',
				'cylinder',
				'ellipse',
				'circle',
				'star',
			] as const) {
				const { svg } = renderToSvg(wobbleScene({ shape: kind }), {
					wobble: true,
				});
				const nodeGroup = svg.match(/<g data-node="a">([\s\S]*?)<\/g>/)?.[1];
				const d = nodeGroup?.match(/data-wobble="true"[^/]*d="([^"]+)"/)?.[1];
				const tokens = d?.trim().split(/\s+/).length ?? 0;
				if (tokens < 64) {
					sparse.push(`${kind}:${tokens}`);
				}
			}
			expect(sparse).toEqual([]);
		});

		test('compound shapes keep clean fills and labels intact under overlays', () => {
			const { svg } = renderToSvg(wobbleScene({ shape: 'cylinder' }), {
				wobble: true,
			});
			const nodeGroup = svg.match(/<g data-node="a">([\s\S]*?)<\/g>/)?.[1];
			expect(nodeGroup).toContain('fill="#e9ecef"');
			expect(nodeGroup).toContain('<ellipse');
			expect(nodeGroup).toContain('>Node A</text>');
			const bodyOverlay = nodeGroup?.indexOf('data-wobble') ?? -1;
			const rimClean = nodeGroup?.indexOf('<ellipse', bodyOverlay) ?? -1;
			const rimOverlay = nodeGroup?.indexOf('data-wobble', rimClean) ?? -1;
			expect(bodyOverlay).toBeGreaterThan(-1);
			expect(rimClean).toBeGreaterThan(bodyOverlay);
			expect(rimOverlay).toBeGreaterThan(rimClean);
		});

		test('overlays follow rotation and identity like single-component shapes', () => {
			const { svg: rotated } = renderToSvg(
				wobbleScene({ rotation: 45, shape: 'actor' }),
				{ wobble: true }
			);
			const nodeGroup = rotated.match(
				/<g data-node="a" transform="rotate\(45 70 52\)">([\s\S]*?)<\/g>/
			)?.[1];
			expect(nodeGroup).toContain('data-wobble="true"');
			expect(overlayCount(rotated, 'a')).toBe(5);

			const overlayDs = (svg: string): string[] =>
				[...svg.matchAll(/data-wobble="true"[^/]*d="([^"]+)"/g)]
					.map((match) => match[1])
					.filter((value): value is string => value !== undefined);
			const { svg: base } = renderToSvg(wobbleScene({ shape: 'cylinder' }), {
				wobble: true,
			});
			const { svg: other } = renderToSvg(
				wobbleScene({ id: 'b', shape: 'cylinder' }),
				{ wobble: true }
			);
			const baseDs = overlayDs(base);
			expect(baseDs).toHaveLength(2);
			expect(overlayDs(other)).toHaveLength(2);
			expect(overlayDs(other)).not.toEqual(baseDs);
		});

		test('degenerate compound shapes degrade to clean geometry only', () => {
			const { svg } = renderToSvg(
				wobbleScene({ height: 0, shape: 'plus', width: 0 }),
				{ wobble: true }
			);
			expect(svg).toContain('data-node="a"');
			expect(svg).not.toContain('data-wobble');
		});

		const edgeScene = (
			edgeOverrides: Partial<Scene['edges'][number]> = {},
			nodeOverrides: Partial<Parameters<typeof sceneNode>[0]> = {}
		): Scene => ({
			edges: [
				{
					from: 'a',
					label: 'relates',
					span,
					to: 'b',
					...edgeOverrides,
				},
			],
			groups: [],
			nodes: [
				sceneNode({
					height: 44,
					id: 'a',
					label: 'Node A',
					span,
					width: 100,
					x: 20,
					y: 30,
					...nodeOverrides,
				}),
				sceneNode({
					height: 44,
					id: 'b',
					label: 'Node B',
					span,
					width: 100,
					x: 260,
					y: 30,
				}),
			],
			title: '',
		});

		test('visible edges get a wobble overlay when enabled', () => {
			const { svg: clean } = renderToSvg(edgeScene());
			expect(clean).not.toContain('data-wobble');
			const { svg } = renderToSvg(edgeScene(), { wobble: true });
			const edgeGroup =
				svg.match(/<g data-edge="a-b">([\s\S]*?)<\/g>/)?.[1] ?? '';
			expect(edgeGroup).toContain('data-wobble="true"');
			expect(edgeGroup).toContain('pointer-events="none"');
			const cleanPath = edgeGroup.indexOf('<path d="M');
			const overlayPath = edgeGroup.indexOf('data-wobble');
			expect(cleanPath).toBeGreaterThanOrEqual(0);
			expect(overlayPath).toBeGreaterThan(cleanPath);
		});

		test('invisible edges never get an overlay', () => {
			const { svg: hidden } = renderToSvg(edgeScene({ invisible: true }), {
				wobble: true,
			});
			expect(hidden).not.toContain('data-edge');
			const { svg: missing } = renderToSvg(edgeScene({ to: 'ghost' }), {
				wobble: true,
			});
			expect(missing).not.toContain('data-edge');
		});

		test('edge markers, dash semantics, and labels stay clean', () => {
			const { svg } = renderToSvg(
				edgeScene({
					bidirectional: true,
					color: 'red',
					dashed: true,
					head: 'circle',
				}),
				{ wobble: true }
			);
			const edgeGroup = svg.match(/<g data-edge="a-b">([\s\S]*?)<\/g>/)?.[1];
			expect(edgeGroup).toContain('marker-end="url(#kiyora-circle)"');
			expect(edgeGroup).toContain('marker-start="url(#kiyora-circle-reverse)"');
			expect(edgeGroup).toContain('stroke-dasharray="4.5 6"');
			expect(edgeGroup).toContain('>relates</text>');
			expect(svg.match(/<text/g)?.length).toBe(3);
			const overlays =
				edgeGroup?.match(/<path data-wobble="true"[^/]*\/>/g) ?? [];
			expect(overlays.length).toBeGreaterThan(5);
			expect(overlays.every((path) => path.includes('fill="#ff6b6b"'))).toBe(
				true
			);
			expect(
				overlays.some(
					(path) =>
						path.includes('stroke-dasharray') || path.includes('marker-end')
				)
			).toBe(false);
		});

		test('edge overlays are deterministic and follow geometry and identity', () => {
			const { svg: first } = renderToSvg(edgeScene(), { wobble: true });
			const { svg: second } = renderToSvg(edgeScene(), { wobble: true });
			expect(first).toBe(second);
			const overlayD = (svg: string, name: string): string | undefined =>
				svg.match(
					new RegExp(
						`<g data-edge="${name}">[\\s\\S]*?data-wobble="true"[^/]*d="([^"]+)"`
					)
				)?.[1];
			const base = overlayD(first, 'a-b');
			expect(base).toBeDefined();
			expect(
				overlayD(
					renderToSvg(edgeScene({}, { x: 24 }), { wobble: true }).svg,
					'a-b'
				)
			).not.toBe(base);
			const twin: Scene = {
				...edgeScene(),
				edges: [{ from: 'c', label: 'relates', span, to: 'd' }],
				nodes: [
					sceneNode({
						height: 44,
						id: 'c',
						span,
						width: 100,
						x: 20,
						y: 30,
					}),
					sceneNode({
						height: 44,
						id: 'd',
						span,
						width: 100,
						x: 260,
						y: 30,
					}),
				],
			};
			const twinD = overlayD(renderToSvg(twin, { wobble: true }).svg, 'c-d');
			expect(twinD).toBeDefined();
			expect(twinD).not.toBe(base);
		});

		test('degenerate edges degrade to clean geometry only', () => {
			const { svg } = renderToSvg(
				edgeScene({}, { height: 0, width: 0, x: 260, y: 52 }),
				{ wobble: true }
			);
			expect(svg).toContain('data-edge="a-b"');
			const edgeGroup = svg.match(/<g data-edge="a-b">([\s\S]*?)<\/g>/)?.[1];
			expect(edgeGroup).not.toContain('data-wobble');
		});

		const groupScene = (
			groupOverrides: Partial<Scene['groups'][number]> = {},
			nodeOverrides: Partial<Parameters<typeof sceneNode>[0]> = {}
		): Scene => ({
			edges: [],
			groups: [
				{
					color: 'gray',
					id: 'g',
					label: 'Group label',
					span,
					...groupOverrides,
				},
			],
			nodes: [
				sceneNode({
					group: 'g',
					height: 44,
					id: 'a',
					label: 'Node A',
					span,
					width: 100,
					x: 20,
					y: 30,
					...nodeOverrides,
				}),
			],
			title: '',
		});

		test('group frames get a wobble overlay when enabled', () => {
			const { svg: clean } = renderToSvg(groupScene());
			expect(clean).not.toContain('data-wobble');
			const { svg } = renderToSvg(groupScene(), { wobble: true });
			const group = svg.match(/<g data-group="g">([\s\S]*?)<\/text><\/g>/)?.[0];
			expect(group).toBeDefined();
			expect(group).toContain('data-wobble="true"');
			expect(group).toContain('pointer-events="none"');
			const cleanRect = group?.indexOf('<rect') ?? -1;
			const overlay = group?.indexOf('data-wobble') ?? -1;
			expect(cleanRect).toBeGreaterThanOrEqual(0);
			expect(overlay).toBeGreaterThan(cleanRect);
		});

		test('group frames keep dash semantics, clean labels, and ink-free text', () => {
			const { svg } = renderToSvg(groupScene(), { wobble: true });
			expect(svg).toContain('stroke-dasharray="6 6"');
			expect(svg).toContain('>Group label</text>');
			const group = svg.match(/<g data-group="g">([\s\S]*?)<\/text><\/g>/)?.[0];
			const overlayPaths =
				group?.match(/<path data-wobble="true"[^/]*\/>/g) ?? [];
			expect(overlayPaths.length).toBeGreaterThan(5);
			expect(
				overlayPaths.every((path) => path.includes('fill="#868e96"'))
			).toBe(true);
			expect(
				overlayPaths.some((path) => path.includes('stroke-dasharray'))
			).toBe(false);
			expect(svg.match(/<text/g)?.length).toBe(2);
		});

		test('empty groups never get an overlay', () => {
			const { svg } = renderToSvg(groupScene(), { wobble: true });
			const orphan: Scene = {
				edges: [],
				groups: groupScene().groups,
				nodes: [],
				title: '',
			};
			const orphanRender = renderToSvg(orphan, { wobble: true });
			expect(orphanRender.svg).not.toContain('data-group');
			expect(orphanRender.svg).not.toContain('data-wobble');
			expect(svg).toContain('data-group="g"');
		});

		test('group overlays are deterministic and follow bounds and identity', () => {
			const { svg: first } = renderToSvg(groupScene(), { wobble: true });
			const { svg: second } = renderToSvg(groupScene(), { wobble: true });
			expect(first).toBe(second);
			const overlayD = (svg: string): string | undefined =>
				svg.match(
					/<g data-group="g">[\s\S]*?data-wobble="true"[^/]*d="([^"]+)"/
				)?.[1];
			const base = overlayD(first);
			expect(base).toBeDefined();
			expect(
				overlayD(renderToSvg(groupScene({}, { x: 60 }), { wobble: true }).svg)
			).not.toBe(base);
			const { svg: twin } = renderToSvg(
				groupScene({ id: 'h' }, { group: 'h' }),
				{ wobble: true }
			);
			const twinD = twin.match(
				/<g data-group="h">[\s\S]*?data-wobble="true"[^/]*d="([^"]+)"/
			)?.[1];
			expect(twinD).toBeDefined();
			expect(twinD).not.toBe(base);
		});
	});

	describe('sequence projection', () => {
		test('renders actors, lifelines, and messages to valid SVG', () => {
			const source = `sequence
title Login Flow
Alice -> Bob: Credentials
Bob --> Alice: Token
`;
			const compiled = compile(parse(source).diagram);
			const result = renderToSvg(compiled);
			expect(result.svg).toContain('Login Flow');
			expect(result.svg).toContain('data-node="alice"');
			expect(result.svg).toContain('data-node="bob"');
			expect(result.svg).toContain('data-edge="alice-lifeline"');
			expect(result.svg).toContain('data-edge="bob-lifeline"');
			expect(result.svg).toContain('data-edge="alice-bob"');
			expect(result.svg).toContain('data-edge="bob-alice"');
			expect(result.svg).toContain('Credentials');
			expect(result.svg).toContain('Token');
			// Lifelines are dashed and have no arrowhead
			expect(result.svg).toMatch(
				/<g data-edge="alice-lifeline">[\s\S]*?stroke-dasharray="4\.5 6"/
			);
			const aliceLifeline = result.svg.match(
				/<g data-edge="alice-lifeline">[\s\S]*?<\/g>/
			)?.[0];
			expect(aliceLifeline).toBeDefined();
			expect(aliceLifeline).not.toContain('marker-end');
			// Messages have arrowheads
			expect(result.svg).toMatch(
				/<g data-edge="alice-bob">[\s\S]*?marker-end="url\(#kiyora-arrow\)"/
			);
		});
	});

	test('honors explicit dimensions, padding, fonts, and the render convenience', () => {
		const options = {
			edgeFontSize: 11,
			fontFamily: 'Test Font',
			height: 300,
			nodeFontSize: 14,
			padding: 10,
			width: 400,
		};
		const result = render(diagram, options);
		expect(result).toEqual(renderToSvg(compile(diagram), options));
		expect(result).toMatchObject({ height: 300, width: 400 });
		expect(result.svg).toContain('font-family="Test Font"');
	});
});
