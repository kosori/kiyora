import type { Board, Shape, TextStyle } from '@kiyora/model';

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

/**
 * Replaces the shape `id` names with whatever `update` returns, or the same
 * board when nothing changed. A label edit is therefore one board change, which
 * is one commit's worth of history the moment #10 lands.
 */
const withShape = (
  board: Board,
  id: string,
  update: (shape: Shape) => Shape
): Board => {
  let changed = false;
  const shapes = board.shapes.map((shape) => {
    if (shape.id !== id) {
      return shape;
    }
    const next = update(shape);
    if (next !== shape) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...board, shapes } : board;
};

/** Sets one shape's label, returning the same board when it did not change. */
export const setShapeText = (board: Board, id: string, text: string): Board =>
  withShape(board, id, (shape) =>
    shape.text === text ? shape : { ...shape, text }
  );

/** Sets one shape's text style, returning the same board when it did not change. */
export const setShapeTextStyle = (
  board: Board,
  id: string,
  textStyle: TextStyle
): Board => withShape(board, id, (shape) => ({ ...shape, textStyle }));

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
