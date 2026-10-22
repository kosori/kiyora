import type { Bounds, Camera } from '@kiyora/model';

/** A point, in whatever coordinates the caller is holding it in. */
export type Point = {
  x: number;
  y: number;
};

/** The canvas the board is looked at through, in screen pixels. */
export type Viewport = {
  w: number;
  h: number;
};

/** The closest a view may come. */
export const MIN_ZOOM = 0.1;

/** The farthest a view may go, so a shape never fills the screen by accident. */
export const MAX_ZOOM = 8;

/** How much one keyboard zoom step or one wheel notch changes the scale. */
export const ZOOM_STEP = 1.2;

/** The grid's spacing in board units, before the view's zoom bands it. */
export const GRID_BASE_STEP = 20;

/** The closest two grid dots may sit on screen, in pixels. */
export const MIN_GRID_SPACING = 16;

/** The margin fitting leaves between the contents and the edge, in pixels. */
export const FIT_PADDING = 32;

/**
 * The margin a keyboard step keeps between the new selection and the view's
 * edge, in pixels. A reveal only pans when the selection would otherwise sit
 * outside that band.
 */
export const REVEAL_MARGIN = 48;

/**
 * The most a find match is magnified. A match is brought into view at its own
 * scale, so a label smaller than the viewport is not blown up past twice life
 * size and a large match still shrinks until it is wholly visible.
 */
export const FOCUS_ZOOM = 2;

/** Holds a zoom inside the limits, so a view can never break the board. */
export const clampZoom = (zoom: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The middle of the canvas, in screen pixels. */
export const viewCentre = (viewport: Viewport): Point => ({
  x: viewport.w / 2,
  y: viewport.h / 2,
});

/** Where a board point appears on screen. */
export const toScreen = (camera: Camera, point: Point): Point => ({
  x: point.x * camera.zoom + camera.x,
  y: point.y * camera.zoom + camera.y,
});

/** The board point under a screen point. */
export const toWorld = (camera: Camera, point: Point): Point => ({
  x: (point.x - camera.x) / camera.zoom,
  y: (point.y - camera.y) / camera.zoom,
});

/**
 * The board box a camera shows through a viewport, in board units: what a
 * renderer may cull against. Exact, not padded — a shape whose box only touches
 * the view is already in it.
 */
export const visibleBounds = (camera: Camera, viewport: Viewport): Bounds => {
  const topLeft = toWorld(camera, { x: 0, y: 0 });
  const bottomRight = toWorld(camera, { x: viewport.w, y: viewport.h });

  return {
    h: bottomRight.y - topLeft.y,
    w: bottomRight.x - topLeft.x,
    x: topLeft.x,
    y: topLeft.y,
  };
};

/** Moves the view by a screen-pixel delta. The zoom does not change. */
export const panBy = (camera: Camera, delta: Point): Camera => ({
  x: camera.x + delta.x,
  y: camera.y + delta.y,
  zoom: camera.zoom,
});

/**
 * Zooms about a screen anchor, so the board point under the pointer stays under
 * the pointer. This is what makes zooming feel like the board rather than a
 * document.
 */
export const zoomAt = (camera: Camera, anchor: Point, zoom: number): Camera => {
  const next = clampZoom(zoom);
  const under = toWorld(camera, anchor);
  return {
    x: anchor.x - under.x * next,
    y: anchor.y - under.y * next,
    zoom: next,
  };
};

/** Zooms about a screen anchor by a ratio. */
export const zoomBy = (camera: Camera, anchor: Point, factor: number): Camera =>
  zoomAt(camera, anchor, camera.zoom * factor);

/** Zooms about a screen anchor by a whole number of keyboard steps. */
export const stepZoom = (
  camera: Camera,
  anchor: Point,
  steps: number
): Camera => zoomBy(camera, anchor, ZOOM_STEP ** steps);

/**
 * Zooms about a screen anchor for a wheel notch. A wheel towards the user
 * (positive delta) zooms out, whichever device delivered it.
 */
export const wheelZoom = (
  camera: Camera,
  anchor: Point,
  deltaY: number
): Camera => zoomBy(camera, anchor, ZOOM_STEP ** (-deltaY / 100));

/**
 * Puts the middle of `content` in the middle of the viewport at `zoom`, so every
 * camera that frames content centres it the same way.
 */
const centredCamera = (
  content: Bounds,
  viewport: Viewport,
  zoom: number
): Camera => {
  const centre = viewCentre(viewport);
  const middle = {
    x: content.x + content.w / 2,
    y: content.y + content.h / 2,
  };

  return {
    x: centre.x - middle.x * zoom,
    y: centre.y - middle.y * zoom,
    zoom,
  };
};

/**
 * Scales the contents up until the tighter axis fits, then centres them. An
 * empty board, or one whose contents have no size, rests at one hundred percent.
 */
export const fitCamera = (
  content: Bounds | null,
  viewport: Viewport,
  padding = FIT_PADDING
): Camera => {
  if (content === null || viewport.w <= 0 || viewport.h <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const available = {
    h: Math.max(viewport.h - padding * 2, 1),
    w: Math.max(viewport.w - padding * 2, 1),
  };
  const zoom = clampZoom(
    Math.min(
      available.w / Math.max(content.w, 1),
      available.h / Math.max(content.h, 1)
    )
  );

  return centredCamera(content, viewport, zoom);
};

/** Comes back to one hundred percent, keeping whatever sat in the middle there. */
export const resetCamera = (camera: Camera, viewport: Viewport): Camera =>
  zoomAt(camera, viewCentre(viewport), 1);

/**
 * Frames one find match: the whole box in the middle of the viewport, with the
 * usual fit padding, and never magnified past `FOCUS_ZOOM`. A match larger than
 * the viewport therefore shrinks until it is all visible, while a label smaller
 * than it stays legible instead of filling the screen with one word.
 */
export const focusCamera = (
  content: Bounds | null,
  viewport: Viewport,
  padding = FIT_PADDING
): Camera => {
  const fitted = fitCamera(content, viewport, padding);
  if (content === null || viewport.w <= 0 || viewport.h <= 0) {
    return fitted;
  }

  return centredCamera(content, viewport, Math.min(FOCUS_ZOOM, fitted.zoom));
};

/**
 * Pans the least distance that brings `content` inside the viewport, keeping
 * `margin` pixels clear of each edge, and never zooms. Content already inside
 * that band leaves the camera untouched, by reference, so a one-shape keyboard
 * step does not move the board at all; a step that does reach the edge moves it
 * by exactly what it overshot. Content too large for the padded view is centred
 * on that axis, because no pan can show all of it.
 */
export const revealCamera = (
  camera: Camera,
  viewport: Viewport,
  content: Bounds,
  margin = REVEAL_MARGIN
): Camera => {
  if (viewport.w <= 0 || viewport.h <= 0) {
    return camera;
  }
  const shift = (start: number, size: number, edge: number): number => {
    const room = edge - margin * 2;
    if (size > room) {
      return (edge - size) / 2 - start;
    }
    if (start < margin) {
      return margin - start;
    }
    if (start + size > edge - margin) {
      return edge - margin - start - size;
    }
    return 0;
  };
  const dx = shift(
    content.x * camera.zoom + camera.x,
    content.w * camera.zoom,
    viewport.w
  );
  const dy = shift(
    content.y * camera.zoom + camera.y,
    content.h * camera.zoom,
    viewport.h
  );

  return dx === 0 && dy === 0
    ? camera
    : { x: camera.x + dx, y: camera.y + dy, zoom: camera.zoom };
};

/** The base step, doubled or halved, until its screen spacing is a legible band. */
export const gridStep = (zoom: number): number => {
  const safe = zoom > 0 && Number.isFinite(zoom) ? zoom : MIN_ZOOM;
  let step = GRID_BASE_STEP;

  while (step * safe < MIN_GRID_SPACING) {
    step *= 2;
  }
  while (step * safe >= MIN_GRID_SPACING * 2) {
    step /= 2;
  }

  return step;
};

/**
 * The grid's spacing in screen pixels: the world step brought through the zoom,
 * so a renderer sizes its tile without touching a coordinate itself.
 */
export const gridSpacing = (zoom: number): number => gridStep(zoom) * zoom;
