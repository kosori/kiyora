import {
  type Board,
  fitSticky,
  type Measurer,
  moveConnector,
  type Shape,
  type TableCell,
  type TableShape,
  type TextStyle,
  tableWithCellText,
  tableWithColumn,
  tableWithHeader,
  tableWithRow,
} from '@kiyora/model';
import { removeShapes } from './connectors';
import { markSourceStale } from './source-state';

/** The board without the named shapes, or the same board when there is nothing to remove. */
export const withoutSelection = (
  board: Board,
  ids: readonly string[]
): Board => (ids.length === 0 ? board : removeShapes(board, ids));

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

/**
 * One shape moved by a delta. A connector carries its authored footprint and its
 * free ends; an end bound to a shape stays with that shape, which is what makes
 * a bound connector re-route with no repair pass. A group has no box to move:
 * its members are the shapes that travel, and its stored box is a stand-in.
 */
export const movedShape = (shape: Shape, dx: number, dy: number): Shape => {
  if (shape.kind === 'group') {
    return shape;
  }
  return shape.kind === 'connector'
    ? moveConnector(shape, dx, dy)
    : { ...shape, x: shape.x + dx, y: shape.y + dy };
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

/**
 * Sets one shape's label, returning the same board when it did not change. A
 * sticky additionally grows to fit its label when a measurer is supplied, so
 * the note's own box carries the change and nothing else on the board moves.
 */
export const setShapeText = (
  board: Board,
  id: string,
  text: string,
  measure?: Measurer
): Board => {
  const next = withShape(board, id, (shape) => {
    const labelled = shape.text === text ? shape : { ...shape, text };
    return labelled.kind === 'sticky' ? fitSticky(labelled, measure) : labelled;
  });

  return markSourceStale(board, next, [id]);
};

/** Sets one shape's text style, returning the same board when it did not change. */
export const setShapeTextStyle = (
  board: Board,
  id: string,
  textStyle: TextStyle
): Board => {
  const next = withShape(board, id, (shape) => ({ ...shape, textStyle }));

  return markSourceStale(board, next, [id]);
};

/**
 * One table rewritten by `update`, returning the same board when the shape is
 * not a table or the update changed nothing. A table edit is authored structure
 * like a label, so it marks a generated frame stale exactly as a label does.
 */
const withTable = (
  board: Board,
  id: string,
  update: (shape: TableShape) => TableShape
): Board => {
  const next = withShape(board, id, (shape) =>
    shape.kind === 'data-table' ? update(shape) : shape
  );

  return markSourceStale(board, next, [id]);
};

/** Sets one table cell's text, returning the same board when nothing changed. */
export const setShapeTableCell = (
  board: Board,
  id: string,
  cell: TableCell,
  text: string
): Board =>
  withTable(board, id, (shape) => tableWithCellText(shape, cell, text));

/** Adds one empty row to a table, as authored state. */
export const addShapeTableRow = (board: Board, id: string): Board =>
  withTable(board, id, tableWithRow);

/** Adds one empty column to a table, as authored state. */
export const addShapeTableColumn = (board: Board, id: string): Board =>
  withTable(board, id, tableWithColumn);

/** Turns a table's header row on or off, as authored state. */
export const setShapeTableHeader = (
  board: Board,
  id: string,
  headerRow: boolean
): Board => withTable(board, id, (shape) => tableWithHeader(shape, headerRow));

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
  const next = {
    ...board,
    shapes: board.shapes.map((shape) =>
      moved.has(shape.id) ? movedShape(shape, dx, dy) : shape
    ),
  };

  return markSourceStale(board, next, ids);
};
