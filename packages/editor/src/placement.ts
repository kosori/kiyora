import { DEFAULT_TEXT_STYLE, type Shape, type Style } from '@kiyora/model';
import type { Point } from './camera';
import type { ShapeTool } from './tools';

/** An axis-aligned box in board units. */
export type Box = {
  h: number;
  w: number;
  x: number;
  y: number;
};

/** One placement gesture: where the pointer went down, and where it came up. */
export type Placement = {
  from: Point;
  to: Point;
};

/** The size a click places a shape, in board units. */
export const DEFAULT_SHAPE_SIZE = { h: 100, w: 160 } as const;

/**
 * The box a placement asks for: the rectangle the gesture swept, or, when it
 * never moved, the default size centred on the point. Either way the point the
 * gesture ended on is a point of the shape the author meant.
 */
export const placementBox = ({ from, to }: Placement): Box => {
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);

  if (w === 0 && h === 0) {
    return {
      h: DEFAULT_SHAPE_SIZE.h,
      w: DEFAULT_SHAPE_SIZE.w,
      x: from.x - DEFAULT_SHAPE_SIZE.w / 2,
      y: from.y - DEFAULT_SHAPE_SIZE.h / 2,
    };
  }

  return { h, w, x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) };
};

/** The first id of `kind` that `existing` does not already hold. */
export const nextShapeId = (
  kind: ShapeTool,
  existing: readonly Shape[]
): string => {
  const used = new Set(existing.map((shape) => shape.id));
  let n = 1;
  while (used.has(`${kind}-${n}`)) {
    n += 1;
  }
  return `${kind}-${n}`;
};

/**
 * The shape a placement asks for: `kind`, in the gesture's box, wearing `style`.
 * A text shape starts empty and wears the default text style, so it can be
 * typed into the moment it lands.
 */
export const shapeFromPlacement = (
  kind: ShapeTool,
  placement: Placement,
  style: Style,
  existing: readonly Shape[]
): Shape => {
  const base = {
    ...placementBox(placement),
    id: nextShapeId(kind, existing),
    locked: false,
    opacity: 1,
    parentId: null,
    rotation: 0,
    style,
  };

  if (kind === 'text') {
    return { ...base, kind: 'text', text: '', textStyle: DEFAULT_TEXT_STYLE };
  }

  return { ...base, kind };
};
