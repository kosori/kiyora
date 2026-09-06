import { describe, expect, test } from 'bun:test';
import { parseAndCompile, parseTitle } from './parse-and-compile';
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

	test('compiles a sequence diagram to a read-only empty Scene', () => {
		const result = parseAndCompile('sequence\ntitle My Flow');

		expect(result.diagnostics).toEqual([]);
		expect(result.scene).toEqual({
			edges: [],
			groups: [],
			nodes: [],
			readOnly: true,
			title: 'My Flow',
		});
	});
});

describe('parseTitle', () => {
	test('returns an empty title for empty Source', () => {
		expect(parseTitle('')).toBe('');
	});

	test('reads the starter Source title', () => {
		expect(parseTitle(STARTER_SOURCE)).toBe('Request pipeline');
	});

	test('reads an explicit title directive', () => {
		expect(parseTitle('architecture\ntitle T\nA -> B')).toBe('T');
	});

	test('reads a sequence diagram title directive', () => {
		expect(parseTitle('sequence\ntitle My Flow')).toBe('My Flow');
	});
});
