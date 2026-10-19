import {
  DEFAULT_TEXT_STYLE,
  type FigureShape,
  type FrameShape,
  type Shape,
  type Style,
  type TextShape,
} from '@kiyora/model';
import type { Point } from './camera';
import type { Placeable } from './tools';

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

/** The size a click places a frame: a region worth holding shapes in. */
export const DEFAULT_FRAME_SIZE = { h: 360, w: 480 } as const;

/**
 * The box a placement asks for: the rectangle the gesture swept, or, when it
 * never moved, the fallback size centred on the point. Either way the point the
 * gesture ended on is a point of the shape the author meant.
 */
export const placementBox = (
  { from, to }: Placement,
  fallback: { h: number; w: number } = DEFAULT_SHAPE_SIZE
): Box => {
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);

  if (w === 0 && h === 0) {
    return {
      h: fallback.h,
      w: fallback.w,
      x: from.x - fallback.w / 2,
      y: from.y - fallback.h / 2,
    };
  }

  return { h, w, x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) };
};

/** The first id of `kind` that `existing` does not already hold. */
export const nextShapeId = (
  kind: Placeable,
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
 * A frame is authored plain and clipping, with a box its own to keep — nothing
 * a later member does resizes it. A text shape starts empty and wears the
 * default text style, so it can be typed into the moment it lands.
 */
export const shapeFromPlacement = (
  kind: Placeable,
  placement: Placement,
  style: Style,
  existing: readonly Shape[]
): Shape => {
  const base = {
    id: nextShapeId(kind, existing),
    locked: false,
    opacity: 1,
    parentId: null,
    rotation: 0,
    style,
  };

  if (kind === 'frame') {
    const frame: FrameShape = {
      ...base,
      ...placementBox(placement, DEFAULT_FRAME_SIZE),
      clip: true,
      kind,
      variant: 'plain',
    };

    return frame;
  }

  if (kind === 'text') {
    const text: TextShape = {
      ...base,
      ...placementBox(placement),
      kind: 'text',
      text: '',
      textStyle: DEFAULT_TEXT_STYLE,
    };

    return text;
  }

  const figure: FigureShape = {
    ...base,
    ...placementBox(placement),
    kind,
  };

  return figure;
};
