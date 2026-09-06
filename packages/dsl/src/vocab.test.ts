import { describe, expect, test } from 'bun:test';

import {
	ARROWS,
	COLOR_ALIASES,
	COLORS,
	CORNERS,
	FAMILIES,
	FILLS,
	FRAMES,
	HEADS,
	resolveColor,
	resolveCorner,
	resolveFill,
	resolveFrame,
	resolveHead,
	resolveShape,
	SHAPE_ALIASES,
	SHAPES,
	STANDALONE_FAMILIES,
	slugify,
	UNSUPPORTED_GRAPH_FAMILIES,
	uniqueId,
} from './vocab';

describe('shapes', () => {
	test('canonical shapes resolve to themselves, case-insensitively', () => {
		expect(resolveShape('rectangle')).toBe('rectangle');
		expect(resolveShape('Cylinder')).toBe('cylinder');
		expect(resolveShape('DOUBLE-CIRCLE')).toBe('double-circle');
	});

	test('every alias resolves to its canonical shape', () => {
		for (const [alias, canonical] of Object.entries(SHAPE_ALIASES)) {
			expect(resolveShape(alias)).toBe(canonical);
		}
	});

	test('documents the headline aliases', () => {
		expect(SHAPE_ALIASES.box).toBe('rectangle');
		expect(SHAPE_ALIASES.db).toBe('cylinder');
		expect(SHAPE_ALIASES.decision).toBe('diamond');
		expect(SHAPE_ALIASES.person).toBe('actor');
	});

	test('unknown tokens resolve to null', () => {
		expect(resolveShape('blob')).toBeNull();
		expect(resolveShape('')).toBeNull();
	});

	test('SHAPES lists canonical names only', () => {
		expect(SHAPES).toContain('cylinder');
		expect(SHAPES).not.toContain('db');
	});
});

describe('colors', () => {
	test('palette colors resolve to themselves', () => {
		for (const color of COLORS) {
			expect(resolveColor(color)).toBe(color);
		}
	});

	test('grey and purple alias to gray and violet', () => {
		expect(resolveColor('grey')).toBe('gray');
		expect(resolveColor('purple')).toBe('violet');
		expect(COLOR_ALIASES.grey).toBe('gray');
		expect(COLOR_ALIASES.purple).toBe('violet');
	});

	test('unknown and deferred colors resolve to null', () => {
		expect(resolveColor('tomato')).toBeNull();
		expect(resolveColor('#ff6347')).toBeNull();
		expect(resolveColor('bluish')).toBeNull();
	});

	test('tokens are trimmed and lowercased', () => {
		expect(resolveColor(' Blue ')).toBe('blue');
	});
});

describe('fills, corners, frames, heads', () => {
	test('fills', () => {
		expect(FILLS).toEqual(['pastel', 'bold', 'outline']);
		for (const fill of FILLS) {
			expect(resolveFill(fill)).toBe(fill);
		}
		expect(resolveFill('BOLD')).toBe('bold');
		expect(resolveFill('solid')).toBeNull();
	});

	test('corners with aliases', () => {
		expect(CORNERS).toEqual(['sharp', 'rounded']);
		expect(resolveCorner('square')).toBe('sharp');
		expect(resolveCorner('round')).toBe('rounded');
		expect(resolveCorner('blobby')).toBeNull();
	});

	test('frames', () => {
		expect(FRAMES).toEqual(['browser', 'phone', 'window', 'tablet']);
		expect(resolveFrame('Browser')).toBe('browser');
		expect(resolveFrame('paper')).toBeNull();
	});

	test('heads with aliases', () => {
		expect(HEADS).toEqual(['arrow', 'circle', 'cross']);
		expect(resolveHead('x')).toBe('cross');
		expect(resolveHead('o')).toBe('circle');
		expect(resolveHead('dot')).toBe('circle');
		expect(resolveHead('square')).toBeNull();
	});
});

describe('arrows', () => {
	test('the connector token list covers every arrow kind', () => {
		const required = [
			'->',
			'-->',
			'-.->',
			'..>',
			'<-.-',
			'<..',
			'<->',
			'<-->',
			'<..>',
			'<-.->',
			'<-',
			'<--',
			'<>',
			'>',
			'<',
		] as const;
		for (const token of required) {
			expect(ARROWS).toContain(token);
		}
	});
});

describe('slugify', () => {
	test('slugifies names per reference semantics', () => {
		expect(slugify('Cache Server')).toBe('cache-server');
		expect(slugify('A -- B')).toBe('a-b');
		expect(slugify('Hello_World!')).toBe('hello-world');
		expect(slugify('already-kebab')).toBe('already-kebab');
	});

	test('strips non-latin characters', () => {
		expect(slugify('Café')).toBe('caf');
	});

	test('falls back to "node" for empty slugs', () => {
		expect(slugify('')).toBe('node');
		expect(slugify('!!!')).toBe('node');
		expect(slugify('   ')).toBe('node');
	});
});

describe('uniqueId', () => {
	test('deduplicates with -2, -3, … suffixes', () => {
		const used = new Set<string>();
		expect(uniqueId('cache-server', used)).toBe('cache-server');
		expect(uniqueId('cache-server', used)).toBe('cache-server-2');
		expect(uniqueId('cache-server', used)).toBe('cache-server-3');
	});

	test('skips suffixes already taken', () => {
		const used = new Set(['a', 'a-2']);
		expect(uniqueId('a', used)).toBe('a-3');
	});

	test('records the id in the used set', () => {
		const used = new Set<string>();
		uniqueId('node', used);
		expect(used.has('node')).toBe(true);
	});
});

describe('families', () => {
	test('graph-family keywords map to their canonical family', () => {
		expect(FAMILIES.architecture).toBe('architecture');
		expect(FAMILIES.graph).toBe('architecture');
		expect(FAMILIES.flowchart).toBe('flowchart');
		expect(FAMILIES.flow).toBe('flowchart');
		expect(FAMILIES.bpmn).toBe('bpmn');
		expect(FAMILIES.orgchart).toBe('orgchart');
		expect(FAMILIES.org).toBe('orgchart');
		expect(FAMILIES.statemachine).toBe('statemachine');
		expect(FAMILIES.state).toBe('statemachine');
		expect(FAMILIES.fsm).toBe('statemachine');
	});

	test('unsupported family keywords are listed for refusal', () => {
		expect(STANDALONE_FAMILIES).toEqual([
			'mindmap',
			'gitgraph',
			'gantt',
			'sankey',
			'infographic',
			'chart',
		]);
		expect(UNSUPPORTED_GRAPH_FAMILIES).toEqual([
			'class',
			'erd',
			'uml',
			'wireframe',
		]);
	});

	test('a whole-line family header must match exactly', () => {
		// `flowchart Cache` is not a header; it stays a node statement.
		expect(FAMILIES['flowchart cache']).toBeUndefined();
		expect(FAMILIES.flowchart).toBe('flowchart');
	});
});
