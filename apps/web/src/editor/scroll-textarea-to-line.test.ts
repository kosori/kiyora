import { describe, expect, test } from 'bun:test';
import { lineScrollTop, measureLineHeight } from './scroll-textarea-to-line';

describe('measureLineHeight', () => {
	test('reads the computed line-height in pixels', () => {
		const el = { style: { lineHeight: '' } } as unknown as HTMLTextAreaElement;
		const result = measureLineHeight(el, () => '20px');
		expect(result).toBe(20);
	});

	test('falls back to fontSize * 1.5 when line-height is "normal"', () => {
		const el = { style: { lineHeight: '' } } as unknown as HTMLTextAreaElement;
		const result = measureLineHeight(el, () => 'normal', 16);
		expect(result).toBe(24);
	});
});

describe('lineScrollTop', () => {
	test('returns the top offset for a 1-based line', () => {
		// line=1 → 0, line=5 with 20px line-height → 80.
		expect(lineScrollTop(1, 20)).toBe(0);
		expect(lineScrollTop(5, 20)).toBe(80);
	});

	test('clamps lines below 1 to line 1', () => {
		expect(lineScrollTop(0, 20)).toBe(0);
		expect(lineScrollTop(-3, 20)).toBe(0);
	});
});
