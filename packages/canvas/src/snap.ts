import type { Point, Viewport } from './viewport';
import { worldToScreen } from './viewport';

/** The always-on snap/nudge grid step, in screen pixels. */
export const SNAP_STEP = 8;

function snapScreen(value: number): number {
	return Math.round(value / SNAP_STEP) * SNAP_STEP;
}

/**
 * The world-space delta that moves `anchor` — the dragged node or the
 * selection's bounding-box top-left — by a cumulative screen-space delta and
 * then snaps it onto the grid.
 */
export function snapDragDelta(
	viewport: Viewport,
	anchor: Point,
	screenDx: number,
	screenDy: number
): Point {
	const start = worldToScreen(viewport, anchor);
	return {
		x: (snapScreen(start.x + screenDx) - start.x) / viewport.zoom,
		y: (snapScreen(start.y + screenDy) - start.y) / viewport.zoom,
	};
}

/** The bounding-box top-left of the given world-space points, or null. */
export function selectionAnchor(points: readonly Point[]): Point | null {
	let x: number | null = null;
	let y: number | null = null;
	for (const { x: pointX, y: pointY } of points) {
		if (x === null || pointX < x) {
			x = pointX;
		}
		if (y === null || pointY < y) {
			y = pointY;
		}
	}
	return x === null || y === null ? null : { x, y };
}
