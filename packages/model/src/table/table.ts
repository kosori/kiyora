import type { TableShape } from '../board/table';
import type { Point } from '../paint/turn';
import { turn } from '../paint/turn';

/**
 * The table kind's derived geometry: the cells a box divides into, the cell a
 * point lands on, and the structure edits the Inspector makes. Nothing here is
 * stored, so a resize reaches every cell without a repair pass.
 */

/** The size a click places a table: room for a small grid. */
export const DEFAULT_TABLE_SIZE = { h: 180, w: 360 } as const;

/** The columns a new table starts with. */
export const DEFAULT_TABLE_COLUMNS = 3;

/** The rows a new table starts with, one of them the header. */
export const DEFAULT_TABLE_ROWS = 3;

/** One cell's place in the grid: its row and its column, counted from zero. */
export type TableCell = {
  column: number;
  row: number;
};

/** An axis-aligned cell box in board coordinates, before the table's rotation. */
export type TableCellBox = {
  h: number;
  w: number;
  x: number;
  y: number;
};

/** A grid of empty cells, row-major, the size a new table starts with. */
export const emptyTableRows = (
  rows: number = DEFAULT_TABLE_ROWS,
  columns: number = DEFAULT_TABLE_COLUMNS
): string[][] =>
  Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));

/** The width one column takes when the authored box is divided evenly. */
const columnWidth = (shape: TableShape): number =>
  shape.columns === 0 ? 0 : shape.w / shape.columns;

/** The height one row takes when the authored box is divided evenly. */
const rowHeight = (shape: TableShape): number =>
  shape.rows.length === 0 ? 0 : shape.h / shape.rows.length;

/**
 * One cell's box in board coordinates, with no rotation applied. The cell is a
 * slice of the authored grid: resizing the table scales it, because nothing but
 * the box and the authored column and row counts decides it.
 */
export const tableCellBox = (
  shape: TableShape,
  row: number,
  column: number
): TableCellBox => ({
  h: rowHeight(shape),
  w: columnWidth(shape),
  x: shape.x + column * columnWidth(shape),
  y: shape.y + row * rowHeight(shape),
});

/** The text one cell carries, or the empty string for a cell no row holds. */
export const tableCellText = (
  shape: TableShape,
  row: number,
  column: number
): string => shape.rows[row]?.[column] ?? '';

/**
 * The cell a board point lands on, its rotation turned back first, or `null`
 * when the point misses the table or the table has no cells. This is the cell
 * the in-place editor opens, so a click and the words it edits cannot disagree.
 */
export const tableCellAt = (
  shape: TableShape,
  point: Point
): TableCell | null => {
  if (shape.columns === 0 || shape.rows.length === 0) {
    return null;
  }
  const centre = { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
  const local = turn(point, centre, -shape.rotation);
  const column = Math.floor((local.x - shape.x) / columnWidth(shape));
  const row = Math.floor((local.y - shape.y) / rowHeight(shape));

  if (
    column < 0 ||
    column >= shape.columns ||
    row < 0 ||
    row >= shape.rows.length
  ) {
    return null;
  }
  return { column, row };
};

/**
 * The table with one empty row appended, as wide as its authored columns. A
 * table with no columns gains one, so the new row always has a cell to type in.
 */
export const tableWithRow = (shape: TableShape): TableShape => {
  const columns = Math.max(1, shape.columns);

  return {
    ...shape,
    columns,
    rows: [...shape.rows, Array.from({ length: columns }, () => '')],
  };
};

/**
 * The table with one empty column appended. Every row grows by one cell; a row
 * shorter than the grid is padded first, so the added column is whole.
 */
export const tableWithColumn = (shape: TableShape): TableShape => ({
  ...shape,
  columns: shape.columns + 1,
  rows: shape.rows.map((cells) => [
    ...Array.from({ length: shape.columns }, (_, index) => cells[index] ?? ''),
    '',
  ]),
});

/** The table with its header row turned on or off, unchanged when it already is. */
export const tableWithHeader = (
  shape: TableShape,
  headerRow: boolean
): TableShape =>
  shape.headerRow === headerRow ? shape : { ...shape, headerRow };

/**
 * The table with one cell's text replaced. A missing cell, or text that did not
 * change, returns the same shape; a row shorter than its column pads to reach
 * the cell rather than dropping the write.
 */
export const tableWithCellText = (
  shape: TableShape,
  cell: TableCell,
  text: string
): TableShape => {
  const cells = shape.rows[cell.row];
  if (cells === undefined || cell.column < 0 || cell.column >= shape.columns) {
    return shape;
  }
  const padded = Array.from(
    { length: Math.max(cells.length, cell.column + 1) },
    (_, index) => cells[index] ?? ''
  );
  if (padded[cell.column] === text) {
    return shape;
  }
  padded[cell.column] = text;

  return {
    ...shape,
    rows: shape.rows.map((row, index) => (index === cell.row ? padded : row)),
  };
};
