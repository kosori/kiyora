import { describe, expect, test } from 'bun:test';
import { edgePathD, intersectRect } from './geometry';

const box = { height: 50, width: 100, x: 0, y: 0 };

describe('geometry', () => {
	test('intersects the rectangle on the appropriate border', () => {
		expect(intersectRect(box, { x: 200, y: 25 })).toEqual({ x: 100, y: 25 });
		expect(intersectRect(box, { x: 50, y: 200 })).toEqual({ x: 50, y: 50 });
		expect(intersectRect(box, { x: 50, y: 25 })).toEqual({ x: 50, y: 25 });
	});

	test('creates deterministic cubic paths between box borders', () => {
		const d = edgePathD(box, { height: 50, width: 100, x: 200, y: 0 });
		expect(d).toBe('M 100 25 C 140 25, 160 25, 200 25');
		expect(edgePathD(box, { ...box })).toBe('M 50 25 C 50 25, 50 25, 50 25');
	});
});
