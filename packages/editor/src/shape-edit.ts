import type { Board, Shape, TextStyle } from '@kiyora/model';

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
