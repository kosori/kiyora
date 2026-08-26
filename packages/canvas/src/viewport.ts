/** A point in either world or screen coordinates. */
export type Point = {
	x: number;
	y: number;
};

/** The camera transform used by the canvas. */
export type Viewport = {
	zoom: number;
	tx: number;
	ty: number;
};

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

/** Create the default, identity viewport. */
export function createViewport(): Viewport {
	return { tx: 0, ty: 0, zoom: 1 };
}

/** Scaffold for the world-to-screen transform. */
export function worldToScreen(_viewport: Viewport, _point: Point): Point {
	throw new Error('worldToScreen is not implemented yet');
}

/** Scaffold for the screen-to-world transform. */
export function screenToWorld(_viewport: Viewport, _point: Point): Point {
	throw new Error('screenToWorld is not implemented yet');
}

/** Scaffold for screen-space panning. */
export function panBy(_viewport: Viewport, _dx: number, _dy: number): Viewport {
	throw new Error('panBy is not implemented yet');
}

/** Scaffold for positioning a world point at a screen point. */
export function panTo(
	_viewport: Viewport,
	_world: Point,
	_screen: Point
): Viewport {
	throw new Error('panTo is not implemented yet');
}

/** Scaffold for cursor-anchored zooming. */
export function zoomAt(
	_viewport: Viewport,
	_anchor: Point,
	_factor: number
): Viewport {
	throw new Error('zoomAt is not implemented yet');
}

/** A world-space rectangle visible through a viewport. */
export type WorldRect = {
	height: number;
	width: number;
	x: number;
	y: number;
};

/** Scaffold for calculating visible world bounds. */
export function visibleWorld(
	_viewport: Viewport,
	_width: number,
	_height: number
): WorldRect {
	throw new Error('visibleWorld is not implemented yet');
}

/** A world-space content rectangle. */
export type Bounds = WorldRect;

/** Scaffold for fitting content to a screen size. */
export function fitToBounds(
	_viewport: Viewport,
	_bounds: Bounds,
	_size: { height: number; width: number }
): Viewport {
	throw new Error('fitToBounds is not implemented yet');
}

/** Scaffold for resetting the camera. */
export function resetView(_viewport: Viewport): Viewport {
	throw new Error('resetView is not implemented yet');
}
