import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	type Diagram,
	type MindMapDiagram,
	parse,
	type Span,
} from '@kiyora/dsl';
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

	test('preserves statemachine and orgchart graph variants on the compiled scene', () => {
		const statemachineScene = compile({
			...diagram,
			variant: 'statemachine',
		});
		expect(statemachineScene.variant).toBe('statemachine');

		const orgchartScene = compile({
			...diagram,
			variant: 'orgchart',
		});
		expect(orgchartScene.variant).toBe('orgchart');
	});

	test('preserves flow on compiled edges', () => {
		const scene = compile({
			...diagram,
			edges: [{ flow: true, from: 'a', span, to: 'b' }],
		});
		expect(scene.edges[0]?.flow).toBe(true);
	});

	test('preserves width on compiled edges', () => {
		const scene = compile({
			...diagram,
			edges: [{ from: 'a', span, to: 'b', width: 5 }],
		});
		expect(scene.edges[0]?.width).toBe(5);
	});

	test('preserves score and value on compiled nodes and edges', () => {
		const scene = compile({
			...diagram,
			edges: [{ from: 'a', score: 88, span, to: 'b', value: 42 }],
			nodes: [
				{ id: 'a', label: 'A', score: 95, span, value: 100 },
				{ id: 'b', label: 'B', span },
			],
		});
		expect(scene.nodes[0]?.score).toBe(95);
		expect(scene.nodes[0]?.value).toBe(100);
		expect(scene.edges[0]?.score).toBe(88);
		expect(scene.edges[0]?.value).toBe(42);
	});

	test('covers each graph variant in contract fixtures', () => {
		const fixtures = [
			'architecture-basic',
			'attributes-a5',
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

	test('covers the mindmap contract fixture', () => {
		const source = readFileSync(join(FIXTURES, 'mindmap-basic.kira'), 'utf8');
		const expected = JSON.parse(
			readFileSync(join(FIXTURES, 'mindmap-basic.json'), 'utf8')
		) as Scene;
		expect(compile(parse(source).diagram)).toEqual(expected);
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

	test('compiles sequence diagram actors into fixed-grid SceneNodes', () => {
		const seqDiagram: Diagram = {
			actors: [
				{ id: 'client', label: 'Client', span },
				{ id: 'server', label: 'Server', span },
			],
			kind: 'sequence',
			messages: [{ from: 'client', label: 'request', span, to: 'server' }],
			title: 'Auth Flow',
		};
		const scene = compile(seqDiagram);
		expect(scene.readOnly).toBe(true);
		expect(scene.title).toBe('Auth Flow');
		expect(scene.nodes).toEqual([
			{
				height: 40,
				id: 'client',
				label: 'Client',
				rotation: 0,
				shape: 'rectangle',
				span,
				width: 100,
				x: 50,
				y: 0,
			},
			{
				height: 40,
				id: 'server',
				label: 'Server',
				rotation: 0,
				shape: 'rectangle',
				span,
				width: 100,
				x: 250,
				y: 0,
			},
		]);
	});

	test('compiles lifelines and horizontal messages with fixed-grid coordinates', () => {
		const seqDiagram: Diagram = {
			actors: [
				{ id: 'a', label: 'A', span },
				{ id: 'b', label: 'B', span },
			],
			kind: 'sequence',
			messages: [
				{ from: 'a', label: 'req', span, to: 'b' },
				{ dashed: true, from: 'b', label: 'res', span, to: 'a' },
			],
			title: '',
		};
		const scene = compile(seqDiagram);
		// Last message is at y = 100 + 1 * 60 = 160. Lifeline capped at 160 + 40 = 200.
		expect(scene.edges).toEqual([
			// Lifelines first
			{
				dashed: true,
				from: 'a',
				span,
				to: 'a',
				y1: 40,
				y2: 200,
			},
			{
				dashed: true,
				from: 'b',
				span,
				to: 'b',
				y1: 40,
				y2: 200,
			},
			// Messages
			{
				from: 'a',
				head: 'arrow',
				label: 'req',
				span,
				to: 'b',
				y: 100,
			},
			{
				dashed: true,
				from: 'b',
				head: 'arrow',
				label: 'res',
				span,
				to: 'a',
				y: 160,
			},
		]);
	});

	test('compiles class diagram relations with both fromCard and toCard', () => {
		const classDiagram: Diagram = {
			entities: [
				{ id: 'user', label: 'User', span },
				{ id: 'order', label: 'Order', span },
			],
			groups: [],
			kind: 'class',
			relations: [
				{
					from: 'user',
					fromCard: 'one',
					span,
					to: 'order',
					toCard: 'many',
				},
			],
			title: 'Store',
		};
		const scene = compile(classDiagram);
		expect(scene.edges).toEqual([
			{
				from: 'user',
				fromHead: 'crow-one',
				head: 'crow-many',
				span,
				to: 'order',
			},
		]);
	});

	test('compiles mindmap diagram with readOnly: true and rounded rectangle root node', () => {
		const mindmapDiagram: MindMapDiagram = {
			kind: 'mindmap',
			root: {
				children: [],
				color: 'blue',
				fill: 'bold',
				id: 'root',
				label: 'Root Node',
				span,
			},
			title: 'Mindmap',
		};
		const scene = compile(mindmapDiagram);
		expect(scene.readOnly).toBe(true);
		expect(scene.title).toBe('Mindmap');
		expect(scene.nodes).toHaveLength(1);
		const [rootNode] = scene.nodes;
		expect(rootNode).toMatchObject({
			color: 'blue',
			corner: 'rounded',
			fill: 'bold',
			id: 'root',
			label: 'Root Node',
			rotation: 0,
			shape: 'rectangle',
			span,
		});
		expect(rootNode?.width).toBeGreaterThan(0);
		expect(rootNode?.height).toBeGreaterThan(0);
		expect(scene.edges).toEqual([]);
		expect(scene.groups).toEqual([]);
	});

	test('compiles mindmap diagram with branches into horizontal tree layout, centering parents without overlap', () => {
		const mindmapDiagram: MindMapDiagram = {
			kind: 'mindmap',
			root: {
				children: [
					{
						children: [
							{
								children: [],
								id: 'sub-1',
								label: 'Sub Branch 1',
								span,
							},
							{
								children: [],
								id: 'sub-2',
								label: 'Sub Branch 2',
								span,
							},
						],
						color: 'blue',
						fill: 'bold',
						id: 'branch-1',
						label: 'Branch 1',
						span,
					},
					{
						children: [],
						id: 'branch-2',
						label: 'Branch 2',
						span,
					},
				],
				id: 'root',
				label: 'Root Node',
				span,
			},
			title: 'Mindmap',
		};

		const scene = compile(mindmapDiagram);
		expect(scene.readOnly).toBe(true);
		expect(scene.nodes).toHaveLength(5);

		const nodeMap = new Map(scene.nodes.map((node) => [node.id, node]));
		const root = nodeMap.get('root');
		const branch1 = nodeMap.get('branch-1');
		const branch2 = nodeMap.get('branch-2');
		const sub1 = nodeMap.get('sub-1');
		const sub2 = nodeMap.get('sub-2');

		expect(root).toBeDefined();
		expect(branch1).toBeDefined();
		expect(branch2).toBeDefined();
		expect(sub1).toBeDefined();
		expect(sub2).toBeDefined();

		if (!(root && branch1 && branch2 && sub1 && sub2)) {
			throw new Error('Expected all nodes to be present');
		}

		expect(branch1.x).toBeGreaterThanOrEqual(root.x + root.width);
		expect(branch2.x).toBeGreaterThanOrEqual(root.x + root.width);
		expect(sub1.x).toBeGreaterThanOrEqual(branch1.x + branch1.width);
		expect(sub2.x).toBeGreaterThanOrEqual(branch1.x + branch1.width);

		expect(branch1).toMatchObject({
			color: 'blue',
			corner: 'rounded',
			fill: 'bold',
			shape: 'rectangle',
		});

		for (const node of scene.nodes) {
			expect(node.shape).toBe('rectangle');
			expect(node.corner).toBe('rounded');
			expect(node.rotation).toBe(0);
		}

		expect(sub1.y + sub1.height).toBeLessThanOrEqual(sub2.y);

		const branch1ChildrenMidY = (sub1.y + sub2.y + sub2.height) / 2;
		const branch1MidY = branch1.y + branch1.height / 2;
		expect(branch1MidY).toBeCloseTo(branch1ChildrenMidY, 1);

		const branch1SubtreeBottom = Math.max(
			branch1.y + branch1.height,
			sub2.y + sub2.height
		);
		expect(branch1SubtreeBottom).toBeLessThanOrEqual(branch2.y);

		const rootChildrenTop = Math.min(branch1.y, sub1.y);
		const rootChildrenBottom = Math.max(branch2.y + branch2.height);
		const rootChildrenMidY = (rootChildrenTop + rootChildrenBottom) / 2;
		const rootMidY = root.y + root.height / 2;
		expect(rootMidY).toBeCloseTo(rootChildrenMidY, 1);

		expect(scene.edges).toEqual([
			{ from: 'root', head: 'none', span, to: 'branch-1' },
			{ from: 'branch-1', head: 'none', span, to: 'sub-1' },
			{ from: 'branch-1', head: 'none', span, to: 'sub-2' },
			{ from: 'root', head: 'none', span, to: 'branch-2' },
		]);
	});
});
