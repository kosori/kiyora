import { describe, expect, test } from 'bun:test';
import { measureLabel, measureLabelWidth, wrapLabel } from './label';

describe('label measurement and wrapping', () => {
	test('uses a deterministic character-width heuristic', () => {
		expect(measureLabelWidth('abcd', 10, 0.5)).toBe(20);
		expect(measureLabelWidth('a\nbb', 10, 0.5)).toBe(10);
	});

	test('wraps words and long words inside the requested width', () => {
		expect(wrapLabel('one two three', 6 * 10 * 0.5, 10, 0.5)).toEqual([
			'one',
			'two',
			'three',
		]);
		expect(wrapLabel('abcdefgh', 3 * 10 * 0.5, 10, 0.5)).toEqual([
			'abc',
			'def',
			'gh',
		]);
	});

	test('reports line count and padded line-height based on wrapped lines', () => {
		expect(
			measureLabel('one two three', {
				charWidth: 0.5,
				fontSize: 10,
				lineHeight: 12,
				maxWidth: 30,
				verticalPadding: 4,
			})
		).toEqual({
			height: 40,
			lineCount: 3,
			lineHeight: 12,
			lines: ['one', 'two', 'three'],
			width: 25,
		});
	});
});
