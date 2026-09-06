import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Diagram, parse, type Span } from '@kiyora/dsl';
import { compile } from './compile';
import type { Scene } from './scene';

const span: Span = {
	end: { column: 4, line: 1 },
	start: { column: 1, line: 1 },
};

const diagram: Diagram = {
	direction: 'down',
	edges: [
		{ color: 'red', from: 'a', head: 'dot', span, to: 'b' },
		{ from: 'missing', span, to: 'a' },
	],
	groups: [
		{ id: 'empty', label: 'Empty', span },
		{ id: 'parent', label: 'Parent', span },
		{ id: 'child', label: 'Child', parent: 'parent', span },
	],
	kind: 'graph',
	legend: [{ label: 'Ready', swatch: 'green' }],
	nodes: [
		{
			color: 'blue',
			corner: 'sharp',
			fill: 'bold',
			group: 'child',
			icon: 'server',
			id: 'a',
			label: 'A',
			labelColor: 'red',
			link: '/a',
			shadow: true,
			shape: 'cylinder',
			span,
		},
		{ id: 'b', label: 'B', span },
	],
	title: 'Example',
};

const FIXTURES = join(import.meta.dir, '..', 'test', 'fixtures');

describe('compile', () => {
	test('assembles nodes, valid edges, active nested groups, and metadata', () => {
		const scene = compile(diagram);
		expect(scene.title).toBe('Example');
		expect(scene.direction).toBe('down');
		expect(scene.legend).toEqual(diagram.legend);
		expect(scene.nodes[0]).toMatchObject(diagram.nodes[0] as object);
		expect(scene.edges).toEqual([
			{ color: 'red', from: 'a', head: 'circle', span, to: 'b' },
		]);
		expect(scene.groups.map((group) => group.id)).toEqual(['parent', 'child']);
	});

	test('emits an explicit rotation of 0 for every compiled node', () => {
		const scene = compile(diagram);
		expect(scene.nodes.length).toBeGreaterThan(0);
		for (const node of scene.nodes) {
			expect(node.rotation).toBe(0);
		}
	});

	test('covers each graph variant in contract fixtures', () => {
		const fixtures = [
			'architecture-basic',
			'bpmn-basic',
			'flowchart-wrapped',
			'orgchart-basic',
			'statemachine-basic',
		] as const;
		for (const fixture of fixtures) {
			const source = readFileSync(join(FIXTURES, `${fixture}.kira`), 'utf8');
			const expected = JSON.parse(
				readFileSync(join(FIXTURES, `${fixture}.json`), 'utf8')
			) as Scene;
			expect(compile(parse(source).diagram)).toEqual(expected);
		}
	});

	test('does not let groups affect node positions', () => {
		const ungrouped = compile({
			...diagram,
			groups: [],
			nodes: diagram.nodes.map((node) => ({ ...node, group: undefined })),
		});
		const grouped = compile(diagram);
		expect(grouped.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
			ungrouped.nodes.map(({ id, x, y }) => ({ id, x, y }))
		);
	});

	test('matches the Diagram-to-Scene contract fixture', () => {
		const source = readFileSync(
			join(FIXTURES, 'architecture-basic.kira'),
			'utf8'
		);
		const expected = JSON.parse(
			readFileSync(join(FIXTURES, 'architecture-basic.json'), 'utf8')
		) as Scene;
		expect(compile(parse(source).diagram)).toEqual(expected);
	});

	test('compiles SequenceDiagram to an empty Scene with title and readOnly: true', () => {
		const seqDiagram: Diagram = {
			actors: [],
			kind: 'sequence',
			messages: [],
			title: 'My Flow',
		};
		const scene = compile(seqDiagram);
		expect(scene).toEqual({
			edges: [],
			groups: [],
			nodes: [],
			readOnly: true,
			title: 'My Flow',
		});
	});
});
