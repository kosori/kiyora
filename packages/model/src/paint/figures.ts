import type { Board, Shape } from '../board/schema';
import { formatNumber } from '../format';
import { connectorBounds } from './connector-route';

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

/**
 * The box a shape paints into against the board it is drawn with. A connector's
 * box is derived from the ends it resolves — the stored one is only its
 * fallback footprint — so selection and the artifact never read a stale box.
 */
export const shapeBounds = (shape: Shape, shapes: readonly Shape[]): Bounds =>
  shape.kind === 'connector' ? connectorBounds(shape, shapes) : boundsOf(shape);

/** The box that holds everything a set of shapes draws, or `null` when there are none. */
export const boundsOfShapes = (shapes: readonly Shape[]): Bounds | null => {
  if (shapes.length === 0) {
    return null;
  }
  const boxes = shapes.map((shape) => shapeBounds(shape, shapes));
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { h: bottom - y, w: right - x, x, y };
};

/**
 * The board's extent: the box that holds everything it draws, or `null` when it
 * draws nothing. Published so both the artifact's crop and the camera's fit read
 * the same value instead of each deriving one.
 */
export const boardBounds = (board: Board): Bounds | null =>
  boundsOfShapes(board.shapes);
