import type { TableShape } from '../board/table';
import { tableCellBox } from '../table/table';
import { type PaintText, textInBox } from '../text/layout';
import { DEFAULT_TEXT_STYLE } from '../text/style';
import { paintBox } from './box';
import type { Paint, PaintContext, PaintPath } from './paint';
import { FOREGROUND, paintColour } from './palette';
import { polygon, polyline } from './shape-path';

/**
 * The table kind's paint: its authored box, a tinted header band, the gridlines
 * that divide it into cells, and each cell's words placed by the same measurer
 * a label uses. Every size comes from dividing the authored box, so a resize
 * scales the grid rather than asking a second stored size to stay in step.
 */

/** The alpha a header row's band lays over the table's own fill. */
const HEADER_ALPHA = 0.08;

/** The alpha the internal gridlines paint at, so they read as rules and not walls. */
const GRID_ALPHA = 0.25;

/** The colour of every gridline, faded by the shape's own opacity. */
const gridInk = (context: PaintContext, opacity: number): string =>
  paintColour(FOREGROUND, context.theme, GRID_ALPHA * opacity);

/** One internal vertical rule at `column` of `columns`. */
const columnRule = (
  shape: TableShape,
  column: number,
  context: PaintContext
): PaintPath => ({
  d: polyline(shape, [
    [column / shape.columns, 0],
    [column / shape.columns, 1],
  ]),
  stroke: gridInk(context, shape.opacity),
  strokeWidth: 1,
});

/** One internal horizontal rule at `row` of `rows`. */
const rowRule = (
  shape: TableShape,
  row: number,
  context: PaintContext
): PaintPath => ({
  d: polyline(shape, [
    [0, row / shape.rows.length],
    [1, row / shape.rows.length],
  ]),
  stroke: gridInk(context, shape.opacity),
  strokeWidth: 1,
});

/** The tinted band the header row wears, drawn over the table's own fill. */
const headerBand = (shape: TableShape, context: PaintContext): PaintPath => ({
  d: polygon(shape, [
    [0, 0],
    [1, 0],
    [1, 1 / shape.rows.length],
    [0, 1 / shape.rows.length],
  ]),
  fill: paintColour(FOREGROUND, context.theme, HEADER_ALPHA * shape.opacity),
});

/**
 * Every cell's text, in reading order. A header cell is bold and measured bold,
 * so it reads as a heading rather than as a differently coloured cell; a cell
 * with no words draws none. A cell's box is the one the grid derives, so the
 * editor's overlay and the canvas agree about where the text sits.
 */
const cellText = (
  shape: TableShape,
  context: PaintContext,
  measure: NonNullable<PaintContext['measure']>
): PaintText[] => {
  const style = shape.textStyle ?? DEFAULT_TEXT_STYLE;
  const fill = paintColour(FOREGROUND, context.theme, shape.opacity);
  const text: PaintText[] = [];

  for (let row = 0; row < shape.rows.length; row += 1) {
    const cells = shape.rows[row] ?? [];
    for (let column = 0; column < shape.columns; column += 1) {
      const value = cells[column] ?? '';
      if (value === '') {
        continue;
      }
      const box = tableCellBox(shape, row, column);
      text.push(
        ...textInBox(box, value, style, measure, fill, {
          bold: shape.headerRow && row === 0,
          origin: { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 },
          ...(shape.rotation === 0 ? {} : { rotation: shape.rotation }),
        })
      );
    }
  }

  return text;
};

/**
 * Paints one table. An empty grid — no rows or no columns — paints its authored
 * box and nothing else, so a degenerate table stays selectable and occupies the
 * space it was given instead of vanishing. A table whose cells hold words and
 * whose context has no measurer fails loudly, like every other piece of text.
 */
export const paintTable = (shape: TableShape, context: PaintContext): Paint => {
  const rows = shape.rows.length;
  const { columns } = shape;

  if (rows === 0 || columns === 0 || shape.w <= 0 || shape.h <= 0) {
    return { children: [], paths: paintBox(shape, context) };
  }

  const paths: PaintPath[] = [...paintBox(shape, context)];
  if (shape.headerRow) {
    paths.push(headerBand(shape, context));
  }
  for (let column = 1; column < columns; column += 1) {
    paths.push(columnRule(shape, column, context));
  }
  for (let row = 1; row < rows; row += 1) {
    paths.push(rowRule(shape, row, context));
  }

  const hasText = shape.rows.some((cells) =>
    cells.some((value) => value !== '')
  );
  if (hasText && context.measure === undefined) {
    throw new Error('painting table cells needs a measurer on the context');
  }
  const text =
    context.measure === undefined
      ? []
      : cellText(shape, context, context.measure);

  return {
    children: [],
    paths,
    ...(text.length === 0 ? {} : { text }),
  };
};
