import type { Board, ChartKind, PaletteColour, Shape } from '@kiyora/model';
import { MAX_CHART_VALUES } from '@kiyora/model';

/**
 * One change to a chart's authored data: the numbers, the categories they belong
 * to, the colours they cycle through, or the kind that draws them. Every field
 * is optional, so a caller writes only what a person changed.
 */
export type ChartEdit = {
  labels?: readonly string[];
  palette?: readonly PaletteColour[];
  series?: readonly number[];
  variant?: ChartKind;
};

/** Whether two lists hold the same values in the same order. */
const sameList = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** The numbers a write may store: finite, at least one, and no more than the schema's cap. */
const seriesOf = (
  edit: readonly number[] | undefined,
  current: readonly number[]
): readonly number[] => {
  if (edit === undefined) {
    return current;
  }
  const finite = edit.filter(Number.isFinite).slice(0, MAX_CHART_VALUES);

  return finite.length === 0 ? current : finite;
};

/**
 * The board after one chart's data is replaced. A chart is authored numbers, so
 * this writes the series itself rather than a picture of it: one call is one
 * board change, which is one gesture and one history entry. A shape that is not
 * a chart, or an edit that asks for exactly what is stored, returns the same
 * board, so the history never records a no-op.
 */
export const editChart = (board: Board, id: string, edit: ChartEdit): Board => {
  let changed = false;
  const shapes = board.shapes.map((shape): Shape => {
    if (shape.id !== id || shape.kind !== 'chart') {
      return shape;
    }

    const variant = edit.variant ?? shape.variant;
    const series = [...seriesOf(edit.series, shape.series)];
    const labels =
      edit.labels === undefined
        ? shape.labels
        : [...edit.labels].slice(0, MAX_CHART_VALUES);
    const palette =
      edit.palette === undefined || edit.palette.length === 0
        ? shape.palette
        : [...edit.palette];

    if (
      variant === shape.variant &&
      sameList(series, shape.series) &&
      sameList(labels, shape.labels) &&
      sameList(palette, shape.palette)
    ) {
      return shape;
    }

    changed = true;

    return { ...shape, labels, palette, series, variant };
  });

  return changed ? { ...board, shapes } : board;
};
