import type { Board, Shape } from '../board/schema';
import { formatNumber } from '../format';
import { inkMargin } from '../ink/ink';
import { connectorBounds } from './connector-route';
import { type Point, turn } from './turn';

/** An axis-aligned box in board coordinates. */
export type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** The centre of an authored box: a shape's, or a frame chrome's. */
export const centreOf = (shape: Pick<Shape, 'h' | 'w' | 'x' | 'y'>): Point => ({
  x: shape.x + shape.w / 2,
  y: shape.y + shape.h / 2,
});

/**
 * The four corners of a shape's box, in drawing order, turned about its centre.
 * Rotation is authored, so corners are derived rather than stored.
 */
export const cornersOf = (shape: Shape): [Point, Point, Point, Point] => {
  const centre = centreOf(shape);
  const corner = (x: number, y: number): Point =>
    turn({ x, y }, centre, shape.rotation);

  return [
    corner(shape.x, shape.y),
    corner(shape.x + shape.w, shape.y),
    corner(shape.x + shape.w, shape.y + shape.h),
    corner(shape.x, shape.y + shape.h),
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
 * The box that holds every one of `boxes`, or `null` when there are none.
 * Separated from `boundsOfShapes` so a group can union the boxes it derives
 * without pretending its members are a second list of shapes.
 */
const unionOf = (boxes: readonly Bounds[]): Bounds | null => {
  if (boxes.length === 0) {
    return null;
  }
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { h: bottom - y, w: right - x, x, y };
};

/** The box an empty group derives: no extent at all, at the board's origin. */
const EMPTY_BOUNDS: Bounds = { h: 0, w: 0, x: 0, y: 0 };

/**
 * The box a group paints into: everything it holds, derived from its members
 * and never read from the copy stored on the group. Nesting is walked flat, so
 * a group inside a group contributes what it holds; the ids already seen are
 * skipped, so a cycle a hand-edited file could name is cut rather than followed
 * forever. A group that holds nothing derives nothing, whether it sits at the
 * top level or inside another group.
 */
const groupBounds = (group: Shape, shapes: readonly Shape[]): Bounds | null => {
  const seen = new Set<string>([group.id]);
  const boxes: Bounds[] = [];
  let parents = new Set<string>([group.id]);

  while (parents.size > 0) {
    const next = new Set<string>();
    for (const shape of shapes) {
      if (
        shape.parentId === null ||
        !parents.has(shape.parentId) ||
        seen.has(shape.id)
      ) {
        continue;
      }
      seen.add(shape.id);
      if (shape.kind === 'group') {
        next.add(shape.id);
      } else if (shape.kind === 'connector') {
        // A member connector's route may resolve against this very group, so
        // measure its authored footprint rather than deriving through the box.
        boxes.push(boundsOf(shape));
      } else {
        boxes.push(shapeBounds(shape, shapes));
      }
    }
    parents = next;
  }

  return unionOf(boxes);
};

/**
 * The box a shape paints into against the board it is drawn with. A connector's
 * box is derived from the ends it resolves — the stored one is only its
 * fallback footprint — and a group's from its members, so selection and the
 * artifact never read a stale box. A group that holds nothing has no extent;
 * its stored box is a stand-in that nothing reads.
 */
export const shapeBounds = (shape: Shape, shapes: readonly Shape[]): Bounds => {
  if (shape.kind === 'connector') {
    return connectorBounds(shape, shapes);
  }
  if (shape.kind === 'group') {
    return groupBounds(shape, shapes) ?? EMPTY_BOUNDS;
  }
  if (shape.kind === 'ink') {
    const box = boundsOf(shape);
    const margin = inkMargin(shape);

    return {
      h: box.h + margin * 2,
      w: box.w + margin * 2,
      x: box.x - margin,
      y: box.y - margin,
    };
  }
  return boundsOf(shape);
};

/**
 * The box that holds everything a set of shapes draws, or `null` when there are
 * none. `context` is the board the shapes are drawn with, so a selected group
 * can still find the members its box derives from; it defaults to the shapes
 * themselves, which is all a list of ordinary shapes needs.
 */
export const boundsOfShapes = (
  shapes: readonly Shape[],
  context: readonly Shape[] = shapes
): Bounds | null => unionOf(shapes.map((shape) => shapeBounds(shape, context)));

/**
 * The board's extent: the box that holds everything it draws, or `null` when it
 * draws nothing. Published so both the artifact's crop and the camera's fit read
 * the same value instead of each deriving one.
 */
export const boardBounds = (board: Board): Bounds | null =>
  boundsOfShapes(board.shapes);
