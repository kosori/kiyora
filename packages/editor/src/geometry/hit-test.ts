import {
  type Bounds,
  CONNECTOR_REACH,
  connectorAt,
  type Shape,
  shapeBounds,
  turn,
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
  const local = turn(point, centre, -shape.rotation);

  return (
    Math.abs(local.x - centre.x) <= shape.w / 2 &&
    Math.abs(local.y - centre.y) <= shape.h / 2
  );
};

/** Whether `point` lies inside an axis-aligned box, its edges included. */
const containsBounds = (bounds: Bounds, point: Point): boolean =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.w &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.h;

/**
 * The topmost shape under `point`, or `null` in empty space. The last shape
 * painted is the one in front, so the search runs back to front. A locked shape
 * is never picked unless `includeLocked` asks for it, which is how the pointer
 * reaches one to unlock it. A connector is picked near its line rather than by
 * its box, and a group by the box its members derive, so a click lands where a
 * person sees the shape or the group's members.
 */
export const shapeAt = (
  shapes: readonly Shape[],
  point: Point,
  includeLocked = false
): Shape | null => {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (shape === undefined || (shape.locked && !includeLocked)) {
      continue;
    }
    const hit =
      shape.kind === 'connector'
        ? connectorAt(shape, shapes, point, CONNECTOR_REACH)
        : shape.kind === 'group'
          ? containsBounds(shapeBounds(shape, shapes), point)
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
