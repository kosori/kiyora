import { describe, expect, test } from 'bun:test';
import {
	COLORS,
	cornerRadius,
	dashAttrs,
	EDGE_STROKE,
	edgeColor,
	INK,
	NODE_FONT_SIZE,
	PALETTE,
	resolveStyle,
	textColorFor,
	WHITE,
} from './style';

describe('style', () => {
	test('contains every palette colour and white in all fill variants', () => {
		for (const color of [...COLORS, 'white'] as const) {
			expect(PALETTE[color].pastel).toStartWith('#');
			expect(PALETTE[color].bold).toStartWith('#');
			expect(PALETTE[color].outline).toStartWith('#');
		}
	});

	test('chooses contrast-aware text', () => {
		expect(textColorFor('#ffffff')).toBe(INK);
		expect(textColorFor('#1e1e1e')).toBe(WHITE);
	});

	test('resolves pastel, bold, outline, and explicit stroke styles', () => {
		expect(resolveStyle('blue', 'pastel')).toMatchObject({
			fill: PALETTE.blue.pastel,
			text: INK,
		});
		expect(resolveStyle('blue', 'bold')).toMatchObject({
			fill: PALETTE.blue.bold,
		});
		expect(resolveStyle('blue', 'outline')).toMatchObject({
			fill: WHITE,
			stroke: PALETTE.blue.outline,
			text: PALETTE.blue.outline,
		});
		expect(resolveStyle('red', 'outline', '#123456').stroke).toBe('#123456');
	});

	test('clamps corner radius', () => {
		expect(cornerRadius(20, 20)).toBe(6);
		expect(cornerRadius(100, 100)).toBe(8);
		expect(cornerRadius(500, 500)).toBe(12);
	});

	test('returns dash attributes', () => {
		expect(dashAttrs('solid')).toEqual({ strokeLinecap: 'round' });
		expect(dashAttrs('dashed')).toEqual({
			dash: 4.5,
			gap: 6,
			strokeDasharray: '4.5 6',
			strokeLinecap: 'round',
		});
		expect(dashAttrs('dotted', 2)).toEqual({
			dash: 0.01,
			gap: 4,
			strokeDasharray: '0.01 4',
			strokeLinecap: 'round',
		});
	});

	test('resolves saturated edge colours and defaults to ink', () => {
		expect(edgeColor()).toBe(INK);
		expect(edgeColor('teal')).toBe(PALETTE.teal.bold);
		expect(EDGE_STROKE).toBe(2.5);
		expect(NODE_FONT_SIZE).toBe(16);
	});
});
