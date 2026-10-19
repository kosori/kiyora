import type { Board, Shape, Style } from '@kiyora/model';
import type { Restyle } from './state';

/** The board with the named shapes swapped for their replacements. */
export const replaceShapes = (
  board: Board,
  replacements: ReadonlyMap<string, Shape>
): Board => {
  if (replacements.size === 0) {
    return board;
  }
  return {
    ...board,
    shapes: board.shapes.map((shape) => replacements.get(shape.id) ?? shape),
  };
};

/** The before-picture of a set of shapes, keyed by id. */
export const snapshotShapes = (
  shapes: readonly Shape[]
): ReadonlyMap<string, Shape> =>
  new Map(shapes.map((shape) => [shape.id, shape]));

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

/** The board with the named shapes moved by `dx`, `dy`, leaving the rest alone. */
export const translateShapes = (
  board: Board,
  ids: readonly string[],
  dx: number,
  dy: number
): Board => {
  if (ids.length === 0) {
    return board;
  }
  const moved = new Set(ids);
  return {
    ...board,
    shapes: board.shapes.map((shape) =>
      moved.has(shape.id)
        ? { ...shape, x: shape.x + dx, y: shape.y + dy }
        : shape
    ),
  };
};

/**
 * The board with the named shapes wearing `change` — a style patch, an opacity,
 * or both — and the style that becomes the one the next shape wears.
 */
export const restyleShapes = (
  board: Board,
  ids: readonly string[],
  change: Restyle
): { board: Board; next: Style | null } => {
  const restyled = new Set(ids);
  let next: Style | null = null;
  let changed = false;
  const shapes = board.shapes.map((shape) => {
    if (!restyled.has(shape.id)) {
      return shape;
    }
    changed = true;
    const touched = {
      ...shape,
      ...(change.opacity === undefined ? {} : { opacity: change.opacity }),
      style:
        change.style === undefined
          ? shape.style
          : { ...shape.style, ...change.style },
    };
    next ??= touched.style;
    return touched;
  });

  return { board: changed ? { ...board, shapes } : board, next };
};
