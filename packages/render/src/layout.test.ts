import { describe, expect, test } from 'bun:test';
import type { Edge, Node, Span } from '@kiyora/dsl';
import { layoutGraph, measureNode } from './layout';

const span: Span = {
	end: { column: 1, line: 1 },
	start: { column: 1, line: 1 },
};

function node(id: string, label = id): Node {
	return { id, label, span };
}

function edge(from: string, to: string): Edge {
	return { from, span, to };
}

describe('layered layout', () => {
	test('places a chain on successive ranks', () => {
		const result = layoutGraph(
			[node('a'), node('b'), node('c')],
			[edge('a', 'b'), edge('b', 'c')]
		);
		const a = result.boxes.get('a');
		const b = result.boxes.get('b');
		const c = result.boxes.get('c');
		expect(a && b && c && a.x < b.x && b.x < c.x).toBe(true);
		expect(a?.y).toBe(b?.y);
		expect(result.width).toBeGreaterThan(result.height);
	});

	test('honors all direction axes and reverse directions', () => {
		const nodes = [node('a'), node('b')];
		const edges = [edge('a', 'b')];
		const right = layoutGraph(nodes, edges, 'right');
		const down = layoutGraph(nodes, edges, 'down');
		const left = layoutGraph(nodes, edges, 'left');
		const up = layoutGraph(nodes, edges, 'up');
		expect(right.boxes.get('a')?.x).toBeLessThan(right.boxes.get('b')?.x ?? 0);
		expect(down.boxes.get('a')?.y).toBeLessThan(down.boxes.get('b')?.y ?? 0);
		expect(left.boxes.get('a')?.x).toBeGreaterThan(left.boxes.get('b')?.x ?? 0);
		expect(up.boxes.get('a')?.y).toBeGreaterThan(up.boxes.get('b')?.y ?? 0);
	});

	test('uses actual node dimensions and configured gaps', () => {
		const nodes = [node('a', 'short'), node('b', 'a much longer label')];
		const result = layoutGraph(nodes, [], 'right', {
			minHeight: 50,
			minWidth: 80,
			nodeGapX: 20,
			nodeGapY: 10,
		});
		const a = result.boxes.get('a');
		const b = result.boxes.get('b');
		expect(a?.width).toBeGreaterThanOrEqual(80);
		expect(a?.height).toBeGreaterThanOrEqual(50);
		expect(b?.x).toBe(a?.x);
		expect((b?.y ?? 0) - (a?.y ?? 0)).toBe((a?.height ?? 0) + 10);
	});

	test('wraps long labels and remains deterministic for cycles', () => {
		const nodes = [
			node(
				'a',
				'one two three four five six seven eight nine ten eleven twelve'
			),
			node('b'),
		];
		const edges = [edge('a', 'b'), edge('b', 'a'), edge('missing', 'a')];
		const first = layoutGraph(nodes, edges);
		const second = layoutGraph(nodes, edges);
		expect(first).toEqual(second);
		expect(first.boxes.get('a')?.height).toBeGreaterThan(
			measureNode(node('b')).height
		);
	});

	test('returns padded bounds for an empty graph', () => {
		expect(layoutGraph([], []).width).toBe(48);
		expect(layoutGraph([], []).height).toBe(48);
	});
});
