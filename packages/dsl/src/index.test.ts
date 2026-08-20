import { describe, expect, test } from 'bun:test';

import { parse } from './index';

describe('parse', () => {
	test('returns an empty graph Diagram with no diagnostics for any input', () => {
		const result = parse('Cache [cylinder, red]\nA -> B\n');
		expect(result).toEqual({
			diagnostics: [],
			diagram: {
				edges: [],
				groups: [],
				kind: 'graph',
				nodes: [],
				title: '',
			},
		});
	});

	test('handles empty and whitespace-only input', () => {
		expect(parse('')).toEqual({
			diagnostics: [],
			diagram: {
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
				edges: [],
				groups: [],
				kind: 'graph',
				nodes: [],
				title: '',
			},
		});
	});
});
