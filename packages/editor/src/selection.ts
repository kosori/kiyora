import {
  type Board,
  type Bounds,
  boundsOfShapes,
  type Shape,
} from '@kiyora/model';

/** The ids of the shapes currently selected, in paint order. Display state, never in the document. */
export type Selection = readonly string[];

/** The selected shapes, in paint order. */
export const selectedShapes = (board: Board, selection: Selection): Shape[] =>
  board.shapes.filter((shape) => selection.includes(shape.id));

/**
 * The ids `selection` names, kept to the shapes the board actually holds and
 * ordered the way the board paints them, so the selection has one reading
 * whichever way it was built.
 */
export const normaliseSelection = (
  board: Board,
  selection: Selection
): string[] =>
  board.shapes
    .filter((shape) => selection.includes(shape.id))
    .map((shape) => shape.id);

/** The box that holds the whole selection, or `null` when nothing is selected. */
export const selectionBounds = (
  board: Board,
  selection: Selection
): Bounds | null => boundsOfShapes(selectedShapes(board, selection));

/** An absolute position per shape id. */
export type Offsets = ReadonlyMap<string, { x: number; y: number }>;

/** Whether both id lists say the same thing, in the same order. */
export const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/** Moves the named shapes to their offsets, leaving every other shape alone. */
export const offsetShapes = (board: Board, offsets: Offsets): Board => {
  if (offsets.size === 0) {
    return board;
  }
  return {
    ...board,
    shapes: board.shapes.map((shape) => {
      const offset = offsets.get(shape.id);
      return offset === undefined ? shape : { ...shape, ...offset };
    }),
  };
};
