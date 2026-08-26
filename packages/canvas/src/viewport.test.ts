import { describe, expect, test } from 'bun:test';
import {
	createViewport,
	fitToBounds,
	MAX_ZOOM,
	MIN_ZOOM,
	panBy,
	panTo,
	resetView,
	screenToWorld,
	visibleWorld,
	worldToScreen,
	zoomAt,
} from './viewport';

function expectPointClose(
	actual: { x: number; y: number },
	expected: { x: number; y: number }
): void {
	expect(actual.x).toBeCloseTo(expected.x, 10);
	expect(actual.y).toBeCloseTo(expected.y, 10);
}

describe('viewport', () => {
	test('round-trips points between world and screen coordinates', () => {
		const viewport = { tx: 40, ty: -18, zoom: 2.5 };
		const world = { x: -12, y: 7.5 };

		const screen = worldToScreen(viewport, world);
		expectPointClose(screen, { x: 10, y: 0.75 });
		expectPointClose(screenToWorld(viewport, screen), world);
	});

	test('pans by screen pixels and positions a world point at a screen point', () => {
		const viewport = { tx: 10, ty: 20, zoom: 2 };
		expect(panBy(viewport, -5, 12)).toEqual({ tx: 5, ty: 32, zoom: 2 });
		expect(panTo(viewport, { x: 4, y: -3 }, { x: 50, y: 80 })).toEqual({
			tx: 42,
			ty: 86,
			zoom: 2,
		});
	});

	test('keeps the world point under the cursor fixed across repeated zoom steps', () => {
		let viewport = { tx: 32, ty: -20, zoom: 1 };
		const anchor = { x: 240, y: 140 };
		const worldAtAnchor = screenToWorld(viewport, anchor);

		for (let step = 0; step < 12; step += 1) {
			viewport = zoomAt(viewport, anchor, 1.2);
		}

		expectPointClose(screenToWorld(viewport, anchor), worldAtAnchor);
	});

	test('clamps zoom and uses the effective factor at both boundaries', () => {
		const anchor = { x: 100, y: 80 };
		const atMinimum = zoomAt({ tx: 25, ty: -10, zoom: 1 }, anchor, 0.001);
		expect(atMinimum.zoom).toBe(MIN_ZOOM);
		expectPointClose(screenToWorld(atMinimum, anchor), { x: 75, y: 90 });

		const atMaximum = zoomAt({ tx: 25, ty: -10, zoom: 1 }, anchor, 100);
		expect(atMaximum.zoom).toBe(MAX_ZOOM);
		expectPointClose(screenToWorld(atMaximum, anchor), { x: 75, y: 90 });
	});

	test('reports the visible world rectangle', () => {
		expect(visibleWorld({ tx: 20, ty: -10, zoom: 2 }, 400, 300)).toEqual({
			height: 150,
			width: 200,
			x: -10,
			y: 5,
		});
	});

	test('fits bounds to a screen size and centers them', () => {
		const viewport = fitToBounds(
			createViewport(),
			{ height: 400, width: 500, x: 100, y: 50 },
			{ height: 300, width: 400 }
		);

		expect(viewport).toEqual({ tx: -62.5, ty: -37.5, zoom: 0.75 });
		const visible = visibleWorld(viewport, 400, 300);
		expect(visible.height).toBe(400);
		expect(visible.width).toBeCloseTo(533.333_333_333_333_3, 10);
		expect(visible.x).toBeCloseTo(83.333_333_333_333_33, 10);
		expect(visible.y).toBe(50);
	});

	test('does not change a viewport when bounds are already fully visible', () => {
		const viewport = { tx: 20, ty: 30, zoom: 2 };
		const fitted = fitToBounds(
			viewport,
			{ height: 40, width: 40, x: 20, y: 30 },
			{ height: 200, width: 200 }
		);

		expect(fitted).toBe(viewport);
	});

	test('resets to the identity camera', () => {
		expect(resetView({ tx: 120, ty: -80, zoom: 3 })).toEqual(createViewport());
	});
});
