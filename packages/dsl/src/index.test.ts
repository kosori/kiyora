import { describe, expect, test } from 'bun:test';

import { parse } from './index';

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

		expect(result.diagram.nodes.map((node) => node.id)).toEqual([
			'b',
			'c',
			'd',
		]);
		expect(result.diagram.edges).toEqual([{ from: 'c', to: 'd' }]);
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

		expect(result.diagram.nodes.map((node) => node.id)).toEqual(['database']);
		expect(result.diagnostics[0]).toMatchObject({
			code: 'unclosed-block',
			severity: 'error',
		});
	});

	test('reports an unmatched closing block as an error and continues', () => {
		const result = parse('}\nCache');

		expect(result.diagram.nodes.map((node) => node.id)).toEqual(['cache']);
		expect(result.diagnostics[0]).toMatchObject({
			code: 'unmatched-block',
			severity: 'error',
		});
	});

	test('does not turn an empty explicit id into a node', () => {
		const result = parse('= Cache\nDatabase');

		expect(result.diagram.nodes.map((node) => node.id)).toEqual(['database']);
		expect(result.diagnostics[0]).toMatchObject({
			code: 'expected-node-name',
			severity: 'error',
		});
	});

	test('parses node statements with spans', () => {
		const result = parse('Cache [cylinder, red]\n');
		expect(result.diagram.kind).toBe('graph');
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
});
