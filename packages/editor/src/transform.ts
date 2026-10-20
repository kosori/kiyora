import { type Bounds, type Shape, turn } from '@kiyora/model';
import type { Point } from './camera';
import {
  type HandleKind,
  handleSigns,
  MIN_SIZE,
  type ResizeModifiers,
  ROTATION_SNAP,
  ROTATION_ZERO,
  resizeBounds,
} from './geometry/handles';
import { snapValue } from './geometry/snap';
import type { GestureModifiers } from './modifiers';

/**
 * Applying a resize or a rotation to the shapes a selection holds. The box the
 * handles sit on is axis-aligned; a single turned shape is resized in its own
 * frame so its anchor corner stays put, and a group is scaled from the box so
 * its members keep their relative positions.
 */

/** The shapes to put back, keyed by id. */
export type Replacements = Map<string, Shape>;

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Trims the noise trigonometry leaves behind, so stored numbers stay honest. */
const clean = (value: number): number => {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
};

/** The centre of a shape's authored box. */
const centreOf = (shape: Shape): Point => ({
  x: shape.x + shape.w / 2,
  y: shape.y + shape.h / 2,
});

/** The angle of `point` about `origin`, in degrees, with straight up as zero. */
export const angleAt = (origin: Point, point: Point): number => {
  const degrees =
    (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI + 90;

  return ((degrees % 360) + 360) % 360;
};

/** The signed turn between two angles, always the short way round. */
export const shortestDelta = (delta: number): number => {
  if (delta > 180) {
    return delta - 360;
  }
  if (delta < -180) {
    return delta + 360;
  }
  return delta;
};

/**
 * The rotation a drag settles on: a fifteen-degree step when shift is held, and
 * exactly zero when it lands within a few degrees of upright, so a bad rotation
 * is cheap to undo.
 */
export const settleRotation = (degrees: number, snap: boolean): number => {
  const stepped = snap
    ? Math.round(degrees / ROTATION_SNAP) * ROTATION_SNAP
    : degrees;
  const wrapped = ((stepped % 360) + 360) % 360;

  return wrapped <= ROTATION_ZERO || 360 - wrapped <= ROTATION_ZERO
    ? 0
    : stepped;
};

/**
 * One shape resized in its own frame: the corner or edge opposite the handle is
 * pinned in world space, and the pointer is measured along the shape's own axes,
 * so a turn is preserved and nothing drifts.
 */
const resizeOne = (
  shape: Shape,
  handle: HandleKind,
  pointer: Point,
  modifiers: ResizeModifiers
): Shape => {
  const signs = handleSigns(handle);
  const point: Point = modifiers.snap
    ? { x: snapValue(pointer.x), y: snapValue(pointer.y) }
    : pointer;
  const angle = radians(shape.rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centre = centreOf(shape);
  const anchorSignX = modifiers.fromCentre ? 0 : signs.x;
  const anchorSignY = modifiers.fromCentre ? 0 : signs.y;
  const offsetX = (-anchorSignX * shape.w) / 2;
  const offsetY = (-anchorSignY * shape.h) / 2;
  const anchor = {
    x: centre.x + offsetX * cos - offsetY * sin,
    y: centre.y + offsetX * sin + offsetY * cos,
  };
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const alongX = dx * cos + dy * sin;
  const alongY = -dx * sin + dy * cos;
  const double = modifiers.fromCentre ? 2 : 1;

  let nextW = shape.w;
  let nextH = shape.h;
  if (signs.x !== 0) {
    nextW = Math.abs(alongX) * double;
  }
  if (signs.y !== 0) {
    nextH = Math.abs(alongY) * double;
  }

  if (modifiers.keepRatio && shape.w > 0 && shape.h > 0) {
    const scale = Math.max(
      signs.x === 0 ? 1 : nextW / shape.w,
      signs.y === 0 ? 1 : nextH / shape.h
    );
    nextW = shape.w * scale;
    nextH = shape.h * scale;
  }

  if (signs.x !== 0) {
    nextW = Math.max(nextW, MIN_SIZE);
  }
  if (signs.y !== 0) {
    nextH = Math.max(nextH, MIN_SIZE);
  }

  const halfW = (anchorSignX * nextW) / 2;
  const halfH = (anchorSignY * nextH) / 2;
  const nextCentre = {
    x: anchor.x + halfW * cos - halfH * sin,
    y: anchor.y + halfW * sin + halfH * cos,
  };

  return {
    ...shape,
    h: clean(nextH),
    w: clean(nextW),
    x: clean(nextCentre.x - nextW / 2),
    y: clean(nextCentre.y - nextH / 2),
  };
};

/**
 * Every selected shape sized to `handle`'s drag. One shape keeps its own frame;
 * a group scales from the selection box, so a turned member is approximated by
 * scaling its box rather than deforming it. `modifiers` is the resolved
 * behaviour; the store turns the gesture vocabulary into it with
 * `resizeModifiers`.
 */
export const resizeSelection = (
  shapes: readonly Shape[],
  bounds: Bounds,
  handle: HandleKind,
  pointer: Point,
  modifiers: ResizeModifiers
): Replacements => {
  const only = shapes.length === 1 ? shapes[0] : undefined;
  if (only !== undefined) {
    return new Map([[only.id, resizeOne(only, handle, pointer, modifiers)]]);
  }

  const to = resizeBounds(bounds, handle, pointer, modifiers);
  const signs = handleSigns(handle);
  const floor = (scale: number, smallest: number): number =>
    smallest > 0 ? Math.max(scale, MIN_SIZE / smallest) : scale;
  const scaleX =
    bounds.w === 0
      ? 1
      : floor(to.w / bounds.w, Math.min(...shapes.map((shape) => shape.w)));
  const scaleY =
    bounds.h === 0
      ? 1
      : floor(to.h / bounds.h, Math.min(...shapes.map((shape) => shape.h)));
  const centre = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  const anchorX = modifiers.fromCentre
    ? centre.x
    : signs.x === 1
      ? bounds.x
      : signs.x === -1
        ? bounds.x + bounds.w
        : centre.x;
  const anchorY = modifiers.fromCentre
    ? centre.y
    : signs.y === 1
      ? bounds.y
      : signs.y === -1
        ? bounds.y + bounds.h
        : centre.y;
  const next: Replacements = new Map();

  for (const shape of shapes) {
    next.set(shape.id, {
      ...shape,
      h: clean(shape.h * scaleY),
      w: clean(shape.w * scaleX),
      x: clean(anchorX + (shape.x - anchorX) * scaleX),
      y: clean(anchorY + (shape.y - anchorY) * scaleY),
    });
  }

  return next;
};

/**
 * Every selected shape turned by `delta` about the selection centre. A shape's
 * own box turns about its centre; a group's members also orbit the selection,
 * so the whole selection reads as one turned thing. The gesture reads one
 * modifiers value, and shift is the constraint that snaps the rotation.
 */
export const rotateSelection = (
  shapes: readonly Shape[],
  origin: Point,
  delta: number,
  modifiers: GestureModifiers
): Replacements => {
  const next: Replacements = new Map();

  for (const shape of shapes) {
    const centre = turn(centreOf(shape), origin, delta);
    next.set(shape.id, {
      ...shape,
      rotation: settleRotation(shape.rotation + delta, modifiers.constrain),
      x: clean(centre.x - shape.w / 2),
      y: clean(centre.y - shape.h / 2),
    });
  }

  return next;
};
