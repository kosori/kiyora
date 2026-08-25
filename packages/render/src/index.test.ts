import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Diagram, parse, type Span } from '@kiyora/dsl';
import { compile, render, renderToSvg, type Scene } from './index';

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
				{
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
				},
				{
					height: 60,
					id: 'b',
					label: 'B',
					span,
					width: 100,
					x: 224,
					y: 24,
				},
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

	test('draws padded nested groups behind nodes and includes them in bounds', () => {
		const scene: Scene = {
			edges: [],
			groups: [
				{ id: 'parent', label: 'Parent', span },
				{ id: 'child', label: 'Child', parent: 'parent', span },
				{ id: 'empty', label: 'Empty', span },
			],
			nodes: [
				{
					group: 'child',
					height: 40,
					id: 'a',
					label: 'A',
					span,
					width: 80,
					x: 50,
					y: 50,
				},
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
				{
					color: 'blue',
					fill: 'pastel',
					height: 44,
					id: 'source',
					label: 'Source',
					span,
					width: 72,
					x: 24,
					y: 24,
				},
				{
					color: 'green',
					fill: 'bold',
					height: 44,
					id: 'target',
					label: 'Target',
					span,
					width: 72,
					x: 168,
					y: 24,
				},
			],
			title: 'Golden',
		});
		expect(result.svg).toMatchSnapshot();
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
