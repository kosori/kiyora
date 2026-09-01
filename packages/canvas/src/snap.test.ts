import { describe, expect, test } from 'bun:test';
import { SNAP_STEP, selectionAnchor, snapDragDelta } from './snap';

describe('snapDragDelta', () => {
	test('snaps a screen-space drag delta to the nearest grid intersection', () => {
		const viewport = { tx: 24, ty: 24, zoom: 1 };
		const anchor = { x: 0, y: 0 };

		expect(snapDragDelta(viewport, anchor, 10, 15)).toEqual({ x: 8, y: 16 });
		expect(snapDragDelta(viewport, anchor, 5, 3)).toEqual({ x: 8, y: 0 });
		expect(snapDragDelta(viewport, anchor, 3, 0)).toEqual({ x: 0, y: 0 });
	});

	test('converts the 8-px screen grid into world units at any zoom', () => {
		const viewport = { tx: 0, ty: 0, zoom: 2 };
		const anchor = { x: 0, y: 0 };

		expect(snapDragDelta(viewport, anchor, 3, 0)).toEqual({ x: 0, y: 0 });
		expect(snapDragDelta(viewport, anchor, 3, 13)).toEqual({ x: 0, y: 8 });
	});

	test('snaps the anchor onto grid intersections in screen space', () => {
		const viewport = { tx: 7, ty: -3, zoom: 1 };
		const anchor = { x: 10, y: 10 };

		const delta = snapDragDelta(viewport, anchor, 5, -5);
		const landed = {
			x: (anchor.x + delta.x) * viewport.zoom + viewport.tx,
			y: (anchor.y + delta.y) * viewport.zoom + viewport.ty,
		};
		expect(landed.x % SNAP_STEP).toBe(0);
		expect(landed.y % SNAP_STEP).toBe(0);
		expect(landed).toEqual({ x: 24, y: 0 });
	});
});

describe('selectionAnchor', () => {
	test('returns the bounding-box top-left across nodes', () => {
		expect(
			selectionAnchor([
				{ x: 40, y: 0 },
				{ x: 0, y: 8 },
				{ x: 20, y: 4 },
			])
		).toEqual({ x: 0, y: 0 });
	});

	test('returns null for an empty set', () => {
		expect(selectionAnchor([])).toBeNull();
	});
});
