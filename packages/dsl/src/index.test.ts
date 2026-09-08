import { describe, expect, test } from 'bun:test';

import {
	type Diagram,
	type GraphDiagram,
	type MindMapDiagram,
	parse,
	parseMindmap,
} from './index';

function assertGraph(diagram: Diagram): asserts diagram is GraphDiagram {
	expect(diagram.kind).toBe('graph');
	if (diagram.kind !== 'graph') {
		throw new Error(`Expected graph diagram, got ${diagram.kind}`);
	}
}

function assertMindmap(diagram: Diagram): asserts diagram is MindMapDiagram {
	expect(diagram.kind).toBe('mindmap');
	if (diagram.kind !== 'mindmap') {
		throw new Error(`Expected mindmap diagram, got ${diagram.kind}`);
	}
}

describe('parse', () => {
	test('handles empty and whitespace-only input as an empty graph Diagram', () => {
		expect(parse('')).toEqual({
			diagnostics: [],
			diagram: {
				direction: 'right',
				edges: [],
				groups: [],
				kind: 'graph',
				nodes: [],
				title: '',
			},
		});
		expect(parse('  \n\t\n  ')).toEqual({
			diagnostics: [],
			diagram: {
				direction: 'right',
				edges: [],
				groups: [],
				kind: 'graph',
				nodes: [],
				title: '',
			},
		});
	});

	test('drops a malformed edge and continues parsing later statements', () => {
		const result = parse('A ->\nB\nC -> D');
		assertGraph(result.diagram);

		expect(result.diagram.nodes.map((node) => node.id)).toEqual([
			'b',
			'c',
			'd',
		]);
		expect(result.diagram.edges).toEqual([
			{
				from: 'c',
				span: {
					end: { column: 6, line: 3 },
					start: { column: 1, line: 3 },
				},
				to: 'd',
			},
		]);
		expect(result.diagnostics).toMatchObject([
			{
				code: 'expected-node-name',
				severity: 'error',
				span: {
					end: { column: 4, line: 1 },
					start: { column: 1, line: 1 },
				},
			},
		]);
	});

	test('reports unclosed groups while retaining their partial content', () => {
		const result = parse('group Services {\nCache\n');
		assertGraph(result.diagram);

		expect(result.diagram.groups.map((group) => group.id)).toEqual([
			'services',
		]);
		expect(result.diagram.nodes.map((node) => node.id)).toEqual(['cache']);
		expect(result.diagnostics).toMatchObject([
			{
				code: 'unclosed-block',
				severity: 'error',
				span: {
					end: { column: 1, line: 3 },
					start: { column: 1, line: 3 },
				},
			},
		]);
	});

	test('drops an unclosed attribute statement and continues parsing', () => {
		const result = parse('Cache [red\nDatabase');
		assertGraph(result.diagram);

		expect(result.diagram.nodes.map((node) => node.id)).toEqual(['database']);
		expect(result.diagnostics[0]).toMatchObject({
			code: 'unclosed-block',
			severity: 'error',
		});
	});

	test('reports an unmatched closing block as an error and continues', () => {
		const result = parse('}\nCache');
		assertGraph(result.diagram);

		expect(result.diagram.nodes.map((node) => node.id)).toEqual(['cache']);
		expect(result.diagnostics[0]).toMatchObject({
			code: 'unmatched-block',
			severity: 'error',
		});
	});

	test('does not turn an empty explicit id into a node', () => {
		const result = parse('= Cache\nDatabase');
		assertGraph(result.diagram);

		expect(result.diagram.nodes.map((node) => node.id)).toEqual(['database']);
		expect(result.diagnostics[0]).toMatchObject({
			code: 'expected-node-name',
			severity: 'error',
		});
	});

	test('parses node statements with spans', () => {
		const result = parse('Cache [cylinder, red]\n');
		assertGraph(result.diagram);
		expect(result.diagram.nodes).toHaveLength(1);
		expect(result.diagram.nodes[0]?.id).toBe('cache');
		expect(result.diagram.nodes[0]?.label).toBe('Cache');
		expect(result.diagram.nodes[0]?.shape).toBe('cylinder');
		expect(result.diagram.nodes[0]?.color).toBe('red');
		expect(result.diagram.nodes[0]?.span).toEqual({
			end: { column: 21, line: 1 },
			start: { column: 1, line: 1 },
		});
		expect(result.diagnostics).toEqual([]);
	});

	test('adds the edge statement span to every produced edge', () => {
		const result = parse('A, B -> C\n');
		assertGraph(result.diagram);

		expect(result.diagram.edges).toHaveLength(2);
		expect(result.diagram.edges[0]?.span).toEqual({
			end: { column: 9, line: 1 },
			start: { column: 1, line: 1 },
		});
		expect(result.diagram.edges[1]?.span).toEqual({
			end: { column: 9, line: 1 },
			start: { column: 1, line: 1 },
		});
	});

	test('uses a later explicit statement name as the redeclared node label', () => {
		const result = parse('Cache [red]\ncache = Cache Server\n');
		assertGraph(result.diagram);
		const [node] = result.diagram.nodes;

		expect(node?.label).toBe('Cache Server');
		expect(node?.color).toBe('red');
	});

	test('statemachine diagram defaults nodes without explicit shape to rounded rectangles', () => {
		const result = parse(
			'statemachine\nStateA -> StateB\nExplicit [diamond]\n'
		);
		assertGraph(result.diagram);

		const stateA = result.diagram.nodes.find((n) => n.id === 'statea');
		const stateB = result.diagram.nodes.find((n) => n.id === 'stateb');
		const explicit = result.diagram.nodes.find((n) => n.id === 'explicit');

		expect(stateA?.shape).toBe('rectangle');
		expect(stateA?.corner).toBe('rounded');

		expect(stateB?.shape).toBe('rectangle');
		expect(stateB?.corner).toBe('rounded');

		expect(explicit?.shape).toBe('diamond');
		expect(explicit?.corner).toBeUndefined();
	});

	const findAsteriskNode = (diagram: GraphDiagram) =>
		diagram.nodes.find((n) => n.label === '[*]' || n.id === '[*]');

	test('statemachine diagram infers [*] with outgoing edges as start state', () => {
		const result = parse('statemachine\n[*] -> StateA\n');
		assertGraph(result.diagram);

		const startNode = findAsteriskNode(result.diagram);
		expect(startNode).toBeDefined();
		expect(startNode?.shape).toBe('circle');
		expect(startNode?.fill).toBe('bold');
		expect(startNode?.color).toBe('gray');
	});

	test('statemachine diagram infers [*] strictly as edge target as end state', () => {
		const result = parse('statemachine\nStateA -> [*]\n');
		assertGraph(result.diagram);

		const endNode = findAsteriskNode(result.diagram);
		expect(endNode).toBeDefined();
		expect(endNode?.shape).toBe('double-circle');
		expect(endNode?.fill).toBeUndefined();
		expect(endNode?.color).toBeUndefined();
	});

	test('statemachine diagram defaults isolated [*] without edges to start state', () => {
		const result = parse('statemachine\n[*]\n');
		assertGraph(result.diagram);

		const node = findAsteriskNode(result.diagram);
		expect(node).toBeDefined();
		expect(node?.shape).toBe('circle');
		expect(node?.fill).toBe('bold');
		expect(node?.color).toBe('gray');
	});

	test('statemachine diagram infers [*] with multiple incoming edges and no outgoing edges as end state', () => {
		const result = parse('statemachine\nStateA -> [*]\nStateB -> [*]\n');
		assertGraph(result.diagram);

		const endNode = findAsteriskNode(result.diagram);
		expect(endNode).toBeDefined();
		expect(endNode?.shape).toBe('double-circle');
		expect(endNode?.fill).toBeUndefined();
		expect(endNode?.color).toBeUndefined();
	});

	const assertSingleAsteriskState = (diagram: GraphDiagram) => {
		const asteriskNodes = diagram.nodes.filter(
			(n) => n.label === '[*]' || n.id === '[*]'
		);
		expect(asteriskNodes).toHaveLength(1);
		expect(asteriskNodes[0]?.shape).toBe('circle');
		expect(asteriskNodes[0]?.fill).toBe('bold');
		expect(asteriskNodes[0]?.color).toBe('gray');
	};

	test('statemachine diagram resolves multiple [*] references to a single node', () => {
		const { diagram } = parse('statemachine\n[*] -> Active\n[*] -> Standby\n');
		assertGraph(diagram);
		assertSingleAsteriskState(diagram);
	});

	test('statemachine diagram preserves single node deduplication when [*] appears as both source and target', () => {
		const { diagram } = parse('statemachine\n[*] -> Active\nActive -> [*]\n');
		assertGraph(diagram);
		assertSingleAsteriskState(diagram);
	});

	test('refuses infographic and chart family headers', () => {
		for (const family of ['infographic', 'chart']) {
			const result = parse(`${family}\nLater Node`);

			expect(result).toEqual({
				diagnostics: [
					{
						code: 'unsupported-family',
						message: `unsupported family "${family}"`,
						severity: 'error',
						span: {
							end: { column: family.length, line: 1 },
							start: { column: 1, line: 1 },
						},
					},
				],
				diagram: {
					direction: 'right',
					edges: [],
					groups: [],
					kind: 'graph',
					nodes: [],
					title: '',
				},
			});
		}
	});

	test('parses empty sequence diagram with optional title', () => {
		const emptyResult = parse('sequence\n');
		expect(emptyResult).toEqual({
			diagnostics: [],
			diagram: {
				actors: [],
				kind: 'sequence',
				messages: [],
				title: '',
			},
		});

		const titledResult = parse('sequence\ntitle My Flow\n');
		expect(titledResult).toEqual({
			diagnostics: [],
			diagram: {
				actors: [],
				kind: 'sequence',
				messages: [],
				title: 'My Flow',
			},
		});

		const leadingTitleResult = parse('title My Flow\nsequence\n');
		expect(leadingTitleResult).toEqual({
			diagnostics: [],
			diagram: {
				actors: [],
				kind: 'sequence',
				messages: [],
				title: 'My Flow',
			},
		});
	});

	test('parses actors and messages in a sequence diagram', () => {
		const source = `sequence
title Auth Flow
actor Client
server = "Auth Server"
Client -> server: Login Request
server --> Client: Token
`;
		const result = parse(source);
		expect(result.diagnostics).toEqual([]);
		expect(result.diagram.kind).toBe('sequence');
		if (result.diagram.kind === 'sequence') {
			expect(result.diagram.title).toBe('Auth Flow');
			expect(result.diagram.actors).toEqual([
				{
					id: 'client',
					label: 'Client',
					span: {
						end: { column: 12, line: 3 },
						start: { column: 1, line: 3 },
					},
				},
				{
					id: 'server',
					label: 'Auth Server',
					span: {
						end: { column: 22, line: 4 },
						start: { column: 1, line: 4 },
					},
				},
			]);
			expect(result.diagram.messages).toEqual([
				{
					from: 'client',
					label: 'Login Request',
					span: {
						end: { column: 31, line: 5 },
						start: { column: 1, line: 5 },
					},
					to: 'server',
				},
				{
					dashed: true,
					from: 'server',
					label: 'Token',
					span: {
						end: { column: 24, line: 6 },
						start: { column: 1, line: 6 },
					},
					to: 'client',
				},
			]);
		}
	});

	test('auto-declares implicit actors from message endpoints', () => {
		const source = `sequence
A -> B: ping
B -> C
`;
		const result = parse(source);
		expect(result.diagnostics).toEqual([]);
		if (result.diagram.kind === 'sequence') {
			expect(
				result.diagram.actors.map((a) => ({ id: a.id, label: a.label }))
			).toEqual([
				{ id: 'a', label: 'A' },
				{ id: 'b', label: 'B' },
				{ id: 'c', label: 'C' },
			]);
			expect(result.diagram.messages.length).toBe(2);
			expect(result.diagram.messages[0]).toMatchObject({
				from: 'a',
				label: 'ping',
				to: 'b',
			});
			expect(result.diagram.messages[1]).toMatchObject({
				from: 'b',
				to: 'c',
			});
			expect(result.diagram.messages[1]?.label).toBeUndefined();
		}
	});

	test('ignores reverse, bidirectional arrows, and chained multi-hop messages in sequence diagrams', () => {
		const source = `sequence
A <- B: pull
A <-- B: reply
A <-> B: sync
A <--> B: sync2
A -> B -> C: multi
`;
		const result = parse(source);
		expect(result.diagnostics).toEqual([]);
		if (result.diagram.kind === 'sequence') {
			expect(result.diagram.messages).toEqual([]);
			expect(result.diagram.actors).toEqual([]);
		}
	});

	test('ignores unhandled raw text without instantiating garbage actors', () => {
		const source = `sequence
actor Client
server = "Auth Server"
Client -> server: Login
random unhandled text
another rogue line
`;
		const result = parse(source);
		expect(result.diagnostics).toEqual([]);
		if (result.diagram.kind === 'sequence') {
			expect(result.diagram.actors.map((a) => a.id)).toEqual([
				'client',
				'server',
			]);
			expect(result.diagram.messages).toHaveLength(1);
			expect(result.diagram.messages[0]).toMatchObject({
				from: 'client',
				label: 'Login',
				to: 'server',
			});
		}
	});

	test('reports expected-node-name when actor statement has no name', () => {
		const source = `sequence
actor
actor Client
`;
		const result = parse(source);
		expect(result.diagnostics).toEqual([
			{
				code: 'expected-node-name',
				message: 'expected an actor name',
				severity: 'error',
				span: {
					end: { column: 5, line: 2 },
					start: { column: 1, line: 2 },
				},
			},
		]);
		if (result.diagram.kind === 'sequence') {
			expect(result.diagram.actors.map((a) => a.id)).toEqual(['client']);
		}
	});

	test('traps self-messages, drops them from AST, and emits a self-edge warning with source span', () => {
		const source = `sequence
Alice -> Alice: self call
Alice -> Bob: ok
`;
		const result = parse(source);
		expect(result.diagram.kind).toBe('sequence');
		if (result.diagram.kind === 'sequence') {
			expect(result.diagram.actors.map((a) => a.id)).toEqual(['alice', 'bob']);
			expect(result.diagram.messages).toHaveLength(1);
			expect(result.diagram.messages[0]).toMatchObject({
				from: 'alice',
				label: 'ok',
				to: 'bob',
			});
		}
		expect(result.diagnostics).toEqual([
			{
				code: 'self-edge',
				message: 'self-edges are not drawn',
				severity: 'warning',
				span: {
					end: { column: 25, line: 2 },
					start: { column: 1, line: 2 },
				},
			},
		]);
	});

	test('delegates mindmap keyword to parseMindmap and extracts title and central node', () => {
		const source = `mindmap
title: Product Roadmap
central: Core Platform
`;
		const result = parse(source);
		expect(result.diagnostics).toEqual([]);
		assertMindmap(result.diagram);
		expect(result.diagram.title).toBe('Product Roadmap');
		expect(result.diagram.root.label).toBe('Core Platform');
		expect(result.diagram.root.id).toBe('core-platform');
		expect(result.diagram.root.children).toEqual([]);
	});

	test('parses nested branches, bullet styles, and inline attributes', () => {
		const source = `mindmap
title: Project Structure
root: Root Node
- Frontend [blue, bold]
  - Web App
  - Mobile App [teal]
* Backend
  * API Gateway
    * Auth Service
`;
		const result = parseMindmap(source);
		expect(result.diagnostics).toEqual([]);
		assertMindmap(result.diagram);
		expect(result.diagram.title).toBe('Project Structure');
		expect(result.diagram.root.label).toBe('Root Node');

		const [frontend, backend] = result.diagram.root.children;
		expect(frontend).toBeDefined();
		expect(backend).toBeDefined();

		expect(frontend?.label).toBe('Frontend');
		expect(frontend?.color).toBe('blue');
		expect(frontend?.fill).toBe('bold');
		expect(frontend?.children).toHaveLength(2);
		expect(frontend?.children[0]?.label).toBe('Web App');
		expect(frontend?.children[1]?.label).toBe('Mobile App');
		expect(frontend?.children[1]?.color).toBe('teal');

		expect(backend?.label).toBe('Backend');
		expect(backend?.children).toHaveLength(1);
		expect(backend?.children[0]?.label).toBe('API Gateway');
		expect(backend?.children[0]?.children).toHaveLength(1);
		expect(backend?.children[0]?.children[0]?.label).toBe('Auth Service');
	});

	test('infers central node from first bare line and falls back sensibly', () => {
		const bareFirst = `mindmap
Implicit Central
  - Child A
`;
		const res1 = parse(bareFirst);
		assertMindmap(res1.diagram);
		expect(res1.diagram.root.label).toBe('Implicit Central');
		expect(res1.diagram.root.children).toHaveLength(1);
		expect(res1.diagram.root.children[0]?.label).toBe('Child A');

		const emptyHeader = parse('mindmap');
		assertMindmap(emptyHeader.diagram);
		expect(emptyHeader.diagram.title).toBe('');
		expect(emptyHeader.diagram.root.label).toBe('Central');
		expect(emptyHeader.diagram.root.id).toBe('central');
		expect(emptyHeader.diagram.root.children).toEqual([]);
	});

	test('degrades gracefully on malformed mindmap input, empty bullets, comments, and unclosed attrs', () => {
		const malformed = `mindmap
title: "Resilient Mindmap"
// this is a comment
central: Root

- 
* [invalid-attr
- Valid Branch [green]
      - Far Indented Child
  - De-indented Sibling
`;
		const result = parse(malformed);
		assertMindmap(result.diagram);
		expect(result.diagram.title).toBe('Resilient Mindmap');
		expect(result.diagram.root.label).toBe('Root');
		expect(result.diagram.root.children.length).toBeGreaterThan(0);

		const validBranch = result.diagram.root.children.find(
			(child) => child.label === 'Valid Branch'
		);
		expect(validBranch).toBeDefined();
		expect(validBranch?.color).toBe('green');
		expect(validBranch?.children[0]?.label).toBe('Far Indented Child');
		expect(validBranch?.children[1]?.label).toBe('De-indented Sibling');
	});
});
