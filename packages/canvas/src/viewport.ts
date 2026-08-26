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

/** Convert a world-space point to screen pixels. */
export function worldToScreen(viewport: Viewport, point: Point): Point {
	return {
		x: point.x * viewport.zoom + viewport.tx,
		y: point.y * viewport.zoom + viewport.ty,
	};
}

/** Convert a screen-space point to world coordinates. */
export function screenToWorld(viewport: Viewport, point: Point): Point {
	return {
		x: (point.x - viewport.tx) / viewport.zoom,
		y: (point.y - viewport.ty) / viewport.zoom,
	};
}

/** Return a viewport panned by a screen-space delta in pixels. */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
	return { ...viewport, tx: viewport.tx + dx, ty: viewport.ty + dy };
}

/** Set the camera so a world-space point sits at a screen-space point. */
export function panTo(
	viewport: Viewport,
	world: Point,
	screen: Point
): Viewport {
	return {
		...viewport,
		tx: screen.x - world.x * viewport.zoom,
		ty: screen.y - world.y * viewport.zoom,
	};
}

/**
 * Zoom by a factor while keeping the world point under `anchor` fixed.
 * The translation uses the effective factor after clamping the zoom.
 */
export function zoomAt(
	viewport: Viewport,
	anchor: Point,
	factor: number
): Viewport {
	const zoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);
	if (zoom === viewport.zoom) {
		return viewport;
	}
	const effectiveFactor = zoom / viewport.zoom;
	return {
		tx: anchor.x * (1 - effectiveFactor) + viewport.tx * effectiveFactor,
		ty: anchor.y * (1 - effectiveFactor) + viewport.ty * effectiveFactor,
		zoom,
	};
}

/** A world-space rectangle visible through a viewport. */
export type WorldRect = {
	height: number;
	width: number;
	x: number;
	y: number;
};

/** Calculate the world-space rectangle visible through a screen viewport. */
export function visibleWorld(
	viewport: Viewport,
	width: number,
	height: number
): WorldRect {
	const topLeft = screenToWorld(viewport, { x: 0, y: 0 });
	return {
		height: height / viewport.zoom,
		width: width / viewport.zoom,
		x: topLeft.x,
		y: topLeft.y,
	};
}

/** A world-space content rectangle. */
export type Bounds = WorldRect;

/**
 * Fit world-space bounds into a screen size while preserving their aspect ratio.
 * A fully visible bounds rectangle is left untouched.
 */
export function fitToBounds(
	viewport: Viewport,
	bounds: Bounds,
	size: { height: number; width: number }
): Viewport {
	if (isFullyVisible(viewport, bounds, size)) {
		return viewport;
	}

	const boundsWidth = Math.max(0, bounds.width);
	const boundsHeight = Math.max(0, bounds.height);
	if (
		boundsWidth === 0 ||
		boundsHeight === 0 ||
		size.width <= 0 ||
		size.height <= 0
	) {
		return viewport;
	}

	const zoom = clamp(
		Math.min(size.width / boundsWidth, size.height / boundsHeight),
		MIN_ZOOM,
		MAX_ZOOM
	);
	return {
		tx: (size.width - bounds.width * zoom) / 2 - bounds.x * zoom,
		ty: (size.height - bounds.height * zoom) / 2 - bounds.y * zoom,
		zoom,
	};
}

function isFullyVisible(
	viewport: Viewport,
	bounds: Bounds,
	size: { height: number; width: number }
): boolean {
	const visible = visibleWorld(viewport, size.width, size.height);
	return (
		bounds.x >= visible.x &&
		bounds.y >= visible.y &&
		bounds.x + bounds.width <= visible.x + visible.width &&
		bounds.y + bounds.height <= visible.y + visible.height
	);
}

/** Reset the camera to the identity viewport. */
export function resetView(_viewport: Viewport): Viewport {
	return createViewport();
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
