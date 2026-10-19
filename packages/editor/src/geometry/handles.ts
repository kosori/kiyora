import type { Bounds } from '@kiyora/model';
import type { Point } from '../camera';
import { GRID } from './snap';

/**
 * Handles: the grab points drawn around a selection. Eight resize a shape from
 * its box, one turns it. The box is axis-aligned even when a shape inside it is
 * turned, so a handle and its hit-test read the same rectangle.
 */

/** The eight resize handles, named by the corner or edge they sit on. */
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

/** One of the eight resize handles. */
export type HandleKind = (typeof HANDLES)[number];

/** A resize handle, or the single rotate handle above the box. */
export type Handle = HandleKind | 'rotate';

/** The side of a handle on screen, in pixels. */
export const HANDLE_SIZE = 8;

/** How far from a handle's centre a pointer still grabs it, in screen pixels. */
export const HANDLE_REACH = 7;

/** How far above the box's top edge the rotate handle floats, in screen pixels. */
export const ROTATE_DISTANCE = 22;

/** The smallest a shape's width or height may become, in board units. */
export const MIN_SIZE = GRID;

/** The step a shift-held rotation lands on, in degrees. */
export const ROTATION_SNAP = 15;

/** How close to zero a free rotation lands before it is taken as exactly zero. */
export const ROTATION_ZERO = 4;

/** Which way a handle moves: with the axis, against it, or neither. */
export type HandleSigns = {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
};

/** The direction a handle drags: `1` with the positive axis, `-1` against it. */
export const handleSigns = (handle: HandleKind): HandleSigns => ({
  x: handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0,
  y: handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0,
});

/** The centre of each of the eight handles on a box. */
export const handlePositions = (bounds: Bounds): Record<HandleKind, Point> => {
  const { x, y, w, h } = bounds;
  const midX = x + w / 2;
  const midY = y + h / 2;

  return {
    e: { x: x + w, y: midY },
    n: { x: midX, y },
    ne: { x: x + w, y },
    nw: { x, y },
    s: { x: midX, y: y + h },
    se: { x: x + w, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: midY },
  };
};

/** Where the rotate handle floats, above the box's top edge, at any zoom. */
export const rotateHandlePosition = (bounds: Bounds, zoom: number): Point => ({
  x: bounds.x + bounds.w / 2,
  y: bounds.y - ROTATE_DISTANCE / zoom,
});

/**
 * The handle under `point`, or `null`. Reach is measured in screen pixels and
 * divided by the zoom, so a handle is as easy to grab close in as far out.
 */
export const handleAt = (
  bounds: Bounds,
  point: Point,
  zoom: number
): Handle | null => {
  const reach = HANDLE_REACH / zoom;
  const near = (target: Point): boolean =>
    Math.hypot(point.x - target.x, point.y - target.y) <= reach;
  const positions = handlePositions(bounds);

  for (const kind of HANDLES) {
    if (near(positions[kind])) {
      return kind;
    }
  }

  return near(rotateHandlePosition(bounds, zoom)) ? 'rotate' : null;
};

/** How a resize reads its modifiers: from the centre, keeping the ratio, snapped. */
export type ResizeModifiers = {
  fromCentre: boolean;
  keepRatio: boolean;
  snap: boolean;
};

const snapped = (value: number, snap: boolean): number =>
  snap ? Math.round(value / GRID) * GRID : value;

/**
 * The box a handle drags a selection to. An edge moves the edge a corner drags;
 * a corner moves both. Alt grows from the centre, shift keeps the ratio, and
 * neither lets the box pass the minimum, so a shape cannot invert or vanish.
 */
export const resizeBounds = (
  bounds: Bounds,
  handle: HandleKind,
  pointer: Point,
  modifiers: ResizeModifiers
): Bounds => {
  const signs = handleSigns(handle);
  const { x, y, w, h } = bounds;
  const centreX = x + w / 2;
  const centreY = y + h / 2;
  const px = snapped(pointer.x, modifiers.snap);
  const py = snapped(pointer.y, modifiers.snap);
  const anchorX = modifiers.fromCentre
    ? centreX
    : signs.x === 1
      ? x
      : signs.x === -1
        ? x + w
        : centreX;
  const anchorY = modifiers.fromCentre
    ? centreY
    : signs.y === 1
      ? y
      : signs.y === -1
        ? y + h
        : centreY;

  let nextW = w;
  let nextH = h;
  const double = modifiers.fromCentre ? 2 : 1;
  if (signs.x !== 0) {
    nextW = Math.abs(px - anchorX) * double;
  }
  if (signs.y !== 0) {
    nextH = Math.abs(py - anchorY) * double;
  }

  if (modifiers.keepRatio && w > 0 && h > 0) {
    const scale = Math.max(
      signs.x === 0 ? 1 : nextW / w,
      signs.y === 0 ? 1 : nextH / h
    );
    nextW = w * scale;
    nextH = h * scale;
  }

  if (signs.x !== 0) {
    nextW = Math.max(nextW, MIN_SIZE);
  }
  if (signs.y !== 0) {
    nextH = Math.max(nextH, MIN_SIZE);
  }

  return {
    h: nextH,
    w: nextW,
    x:
      modifiers.fromCentre || signs.x === 0
        ? anchorX - nextW / 2
        : signs.x === 1
          ? anchorX
          : anchorX - nextW,
    y:
      modifiers.fromCentre || signs.y === 0
        ? anchorY - nextH / 2
        : signs.y === 1
          ? anchorY
          : anchorY - nextH,
  };
};
