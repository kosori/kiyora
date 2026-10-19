import {
  type Bounds,
  CONNECTOR_REACH,
  connectorAt,
  type Shape,
  shapeBounds,
} from '@kiyora/model';
import type { Point } from '../camera';

/**
 * Hit-testing: whether a board point lands on a shape as it is painted. It
 * reads the shape's box and its rotation, the same two the paint walker turns
 * into corners, so a click and the shape it selects cannot disagree.
 */

/**
 * Whether `point` lies inside `shape` as painted, its rotation about its centre
 * included. The point is turned back onto the shape's own axes, so a rotated
 * shape is picked exactly where it is drawn rather than by its loose box.
 */
export const containsPoint = (shape: Shape, point: Point): boolean => {
  const centre = { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
  const radians = (-shape.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return Math.abs(localX) <= shape.w / 2 && Math.abs(localY) <= shape.h / 2;
};

/**
 * The topmost shape under `point`, or `null` in empty space. The last shape
 * painted is the one in front, so the search runs back to front. A locked shape
 * is never picked. A connector is picked near its line rather than by its box,
 * so a click lands on the line where a person sees it.
 */
export const shapeAt = (
  shapes: readonly Shape[],
  point: Point
): Shape | null => {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (shape === undefined || shape.locked) {
      continue;
    }
    const hit =
      shape.kind === 'connector'
        ? connectorAt(shape, shapes, point, CONNECTOR_REACH)
        : containsPoint(shape, point);
    if (hit) {
      return shape;
    }
  }
  return null;
};

/** The box a marquee swept, whichever way the pointer was dragged. */
export const boxBetween = (from: Point, to: Point): Bounds => ({
  h: Math.abs(to.y - from.y),
  w: Math.abs(to.x - from.x),
  x: Math.min(from.x, to.x),
  y: Math.min(from.y, to.y),
});

/** Whether two boxes overlap. A marquee covers a shape when their boxes meet. */
export const boxesIntersect = (a: Bounds, b: Bounds): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Every unlocked shape a marquee covers, in paint order. A shape is covered
 * when the box it paints into meets the marquee, so brushing the edge of a
 * shape is enough to catch it.
 */
export const shapesInBox = (shapes: readonly Shape[], box: Bounds): Shape[] =>
  shapes.filter(
    (shape) => !shape.locked && boxesIntersect(shapeBounds(shape, shapes), box)
  );
