import { describe, expect, test } from 'bun:test';

import { type Diagram, type GraphDiagram, parse } from './index';

function assertGraph(diagram: Diagram): asserts diagram is GraphDiagram {
	expect(diagram.kind).toBe('graph');
	if (diagram.kind !== 'graph') {
		throw new Error(`Expected graph diagram, got ${diagram.kind}`);
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

	test('handles reverse message arrows in sequence diagrams', () => {
		const source = `sequence
A <- B: pull
A <-- B: reply
`;
		const result = parse(source);
		expect(result.diagnostics).toEqual([]);
		if (result.diagram.kind === 'sequence') {
			expect(result.diagram.messages).toEqual([
				expect.objectContaining({
					from: 'b',
					label: 'pull',
					to: 'a',
				}),
				expect.objectContaining({
					dashed: true,
					from: 'b',
					label: 'reply',
					to: 'a',
				}),
			]);
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

	test('traps reverse self-messages (A <- A) and emits a self-edge warning', () => {
		const source = `sequence
Loop <- Loop: loopback
`;
		const result = parse(source);
		expect(result.diagram.kind).toBe('sequence');
		if (result.diagram.kind === 'sequence') {
			expect(result.diagram.actors.map((a) => a.id)).toEqual(['loop']);
			expect(result.diagram.messages).toHaveLength(0);
		}
		expect(result.diagnostics).toEqual([
			{
				code: 'self-edge',
				message: 'self-edges are not drawn',
				severity: 'warning',
				span: {
					end: { column: 22, line: 2 },
					start: { column: 1, line: 2 },
				},
			},
		]);
	});
});
