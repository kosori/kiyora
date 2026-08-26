import { describe, expect, test } from 'bun:test';
import { parseAndCompile } from './parse-and-compile';
import { STARTER_SOURCE } from './starter';

describe('parseAndCompile', () => {
	test('returns an empty Scene without diagnostics for empty Source', () => {
		expect(parseAndCompile('')).toEqual({
			diagnostics: [],
			scene: { edges: [], groups: [], nodes: [], title: '' },
		});
	});

	test('compiles the clean starter Source', () => {
		const result = parseAndCompile(STARTER_SOURCE);

		expect(result.diagnostics).toEqual([]);
		expect(result.scene.title).toBe('Request pipeline');
		expect(result.scene.nodes.length).toBeGreaterThan(0);
		expect(result.scene.groups.length).toBe(3);
		expect(result.scene.edges.length).toBeGreaterThan(0);
	});

	test('retains a best-effort Scene alongside diagnostics', () => {
		const result = parseAndCompile('architecture\nUnknown [not-a-shape]');

		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.scene.nodes).toHaveLength(1);
	});
});
