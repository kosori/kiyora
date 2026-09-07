import { describe, expect, test } from 'bun:test';

import {
	findConnector,
	findToken,
	scanHops,
	splitOn,
	splitTrailingAttrs,
	stripComment,
	unquote,
} from './scan';

import { ARROWS } from './vocab';

describe('stripComment', () => {
	test('strips a // comment from the end of a line', () => {
		expect(stripComment('A -> B // edge')).toBe('A -> B ');
	});

	test('leaves lines without comments untouched', () => {
		expect(stripComment('A -> B')).toBe('A -> B');
	});

	test('ignores // inside quotes', () => {
		expect(stripComment('A [link: "http://x"]')).toBe('A [link: "http://x"]');
	});

	test('ignores // inside attribute brackets', () => {
		expect(stripComment('A [note // hidden]')).toBe('A [note // hidden]');
	});

	test('strips a comment that follows a quoted value', () => {
		expect(stripComment('A [link: "http://x"] // real')).toBe(
			'A [link: "http://x"] '
		);
	});
});

describe('findToken', () => {
	test('finds a token at depth zero', () => {
		expect(findToken('A -> B', '->')).toBe(2);
	});

	test('respects a from offset', () => {
		expect(findToken('A -> B -> C', '->', 4)).toBe(7);
		expect(findToken('A -> B', '->', 3)).toBe(-1);
	});

	test('ignores tokens inside quotes', () => {
		expect(findToken('A "->" B', '->')).toBe(-1);
	});

	test('ignores tokens inside brackets and finds the one outside', () => {
		expect(findToken('[a -> b] -> c', '->')).toBe(9);
		expect(findToken('A [x -> y]', '->')).toBe(-1);
	});

	test('returns -1 when the token is absent', () => {
		expect(findToken('A -> B', '<-')).toBe(-1);
	});
});

describe('splitOn', () => {
	test('splits on a single-character delimiter', () => {
		expect(splitOn('A, B, C', ',')).toEqual(['A', ' B', ' C']);
	});

	test('splits on a multi-character delimiter', () => {
		expect(splitOn('A -> B', '->')).toEqual(['A ', ' B']);
	});

	test('keeps quoted delimiters intact', () => {
		expect(splitOn('A, "b, c"', ',')).toEqual(['A', ' "b, c"']);
	});

	test('keeps delimiters inside nested brackets intact', () => {
		expect(splitOn('[a, [b, c]], d', ',')).toEqual(['[a, [b, c]]', ' d']);
	});

	test('preserves trailing empty segments', () => {
		expect(splitOn('a,', ',')).toEqual(['a', '']);
	});
});

describe('findConnector', () => {
	test('finds the first connector outside quotes and brackets', () => {
		expect(findConnector('A -> B', ARROWS)).toEqual({ index: 2, token: '->' });
	});

	test('respects a from offset', () => {
		expect(findConnector('A -> B -> C', ARROWS, 4)).toEqual({
			index: 7,
			token: '->',
		});
		expect(findConnector('A -> B', ARROWS, 3)).toBeNull();
	});

	test('ignores connectors inside quotes', () => {
		expect(findConnector('A "->" B -> C', ARROWS)).toEqual({
			index: 9,
			token: '->',
		});
	});

	test('ignores connectors inside attribute brackets', () => {
		expect(findConnector('A [x -> y] -> C', ARROWS)).toEqual({
			index: 11,
			token: '->',
		});
		expect(findConnector('A [x -> y]', ARROWS)).toBeNull();
	});

	test('prefers the longest matching token', () => {
		expect(findConnector('A <-.- B', ARROWS)).toEqual({
			index: 2,
			token: '<-.-',
		});
		expect(findConnector('A <-- B', ARROWS)).toEqual({
			index: 2,
			token: '<--',
		});
	});

	test('requires surrounding spaces for the bare > token only', () => {
		expect(findConnector('A > B', ARROWS)).toEqual({ index: 2, token: '>' });
		expect(findConnector('A>B', ARROWS)).toBeNull();
		expect(findConnector('A >B', ARROWS)).toBeNull();
		expect(findConnector('A> B', ARROWS)).toBeNull();
	});

	test('arrow tokens match without surrounding spaces', () => {
		expect(findConnector('A->B', ARROWS)).toEqual({ index: 1, token: '->' });
		expect(findConnector('A-->B', ARROWS)).toEqual({ index: 1, token: '-->' });
		expect(findConnector('A<B', ARROWS)).toEqual({ index: 1, token: '<' });
	});

	test('returns null when no connector exists', () => {
		expect(findConnector('Cache [cylinder]', ARROWS)).toBeNull();
	});
});

describe('scanHops', () => {
	test('splits a simple edge into first segment and one hop', () => {
		expect(scanHops('A -> B', ARROWS)).toEqual({
			first: 'A ',
			hops: [{ segment: ' B', start: 4, token: '->' }],
		});
	});

	test('splits a chain into one hop per connector', () => {
		expect(scanHops('A -> B -> C', ARROWS)).toEqual({
			first: 'A ',
			hops: [
				{ segment: ' B ', start: 4, token: '->' },
				{ segment: ' C', start: 9, token: '->' },
			],
		});
	});

	test('keeps connectors inside quotes intact', () => {
		expect(scanHops('A "-> B" -> C', ARROWS)).toEqual({
			first: 'A "-> B" ',
			hops: [{ segment: ' C', start: 11, token: '->' }],
		});
	});

	test('returns null when the source has no connector', () => {
		expect(scanHops('Cache [cylinder]', ARROWS)).toBeNull();
	});
});

describe('unquote', () => {
	test('removes surrounding quotes', () => {
		expect(unquote('"Cache Server"')).toBe('Cache Server');
	});

	test('trims surrounding whitespace', () => {
		expect(unquote('  "x"  ')).toBe('x');
		expect(unquote(' plain ')).toBe('plain');
	});

	test('leaves unterminated quotes alone', () => {
		expect(unquote('"unterminated')).toBe('"unterminated');
	});

	test('handles empty strings', () => {
		expect(unquote('')).toBe('');
		expect(unquote('""')).toBe('');
	});
});

describe('splitTrailingAttrs', () => {
	test('splits a trailing attribute block', () => {
		expect(splitTrailingAttrs('Cache [cylinder, red]')).toEqual({
			attrs: 'cylinder, red',
			rest: 'Cache ',
		});
	});

	test('returns null attrs when there is no block', () => {
		expect(splitTrailingAttrs('A -> B')).toEqual({
			attrs: null,
			rest: 'A -> B',
		});
	});

	test('keeps brackets inside quoted values intact', () => {
		expect(splitTrailingAttrs('A [icon: "x]y"]')).toEqual({
			attrs: 'icon: "x]y"',
			rest: 'A ',
		});
	});

	test('takes the last block only', () => {
		expect(splitTrailingAttrs('A [x] [y]')).toEqual({
			attrs: 'y',
			rest: 'A [x] ',
		});
	});

	test('returns null attrs for an unclosed block', () => {
		expect(splitTrailingAttrs('A [red')).toEqual({
			attrs: null,
			rest: 'A [red',
		});
	});

	test('handles empty attribute blocks', () => {
		expect(splitTrailingAttrs('A []')).toEqual({ attrs: '', rest: 'A ' });
	});

	test('does not treat [*] as an attribute block', () => {
		expect(splitTrailingAttrs('[*]')).toEqual({ attrs: null, rest: '[*]' });
	});

	test('splits trailing attributes on [*] node', () => {
		expect(splitTrailingAttrs('[*] [red]')).toEqual({
			attrs: 'red',
			rest: '[*] ',
		});
	});
});
