import type { Shape } from '../board/schema';
import { formatNumber } from '../format';

/** A point in board coordinates. */
export type Point = {
  x: number;
  y: number;
};

/** An axis-aligned box in board coordinates. */
export type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * The four corners of a shape's box, in drawing order, turned about its centre.
 * Rotation is authored, so corners are derived rather than stored.
 */
export const cornersOf = (shape: Shape): [Point, Point, Point, Point] => {
  const centre = { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
  const radians = (shape.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const turn = (x: number, y: number): Point => ({
    x: centre.x + (x - centre.x) * cos - (y - centre.y) * sin,
    y: centre.y + (x - centre.x) * sin + (y - centre.y) * cos,
  });

  return [
    turn(shape.x, shape.y),
    turn(shape.x + shape.w, shape.y),
    turn(shape.x + shape.w, shape.y + shape.h),
    turn(shape.x, shape.y + shape.h),
  ];
};

/** The path a rectangle traces, with its rotation already in the coordinates. */
export const rectanglePath = (shape: Shape): string => {
  const [first, ...rest] = cornersOf(shape);
  const moves = rest.map(
    (corner) => `L ${formatNumber(corner.x)} ${formatNumber(corner.y)}`
  );
  return `M ${formatNumber(first.x)} ${formatNumber(first.y)} ${moves.join(' ')} Z`;
};

/** The box that holds everything a shape draws. */
export const boundsOf = (shape: Shape): Bounds => {
  const corners = cornersOf(shape);
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { h: Math.max(...ys) - y, w: Math.max(...xs) - x, x, y };
};

/** The box that holds every shape on the board, or `null` when there are none. */
export const boundsOfShapes = (shapes: readonly Shape[]): Bounds | null => {
  if (shapes.length === 0) {
    return null;
  }
  const boxes = shapes.map(boundsOf);
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { h: bottom - y, w: right - x, x, y };
};
