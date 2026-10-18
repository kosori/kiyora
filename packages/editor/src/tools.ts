import type { FigureKind, Style } from '@kiyora/model';

/** A tool the rail offers: `select`, or a figure kind that places one when the canvas is dragged. */
export type Tool = 'select' | FigureKind;

/**
 * The style the first shape wears, and the one place the next shape's style
 * comes from until something — the inspector — changes it. The picker reads the
 * same value as its default, so a board of one colour needs no restyling.
 */
export const DEFAULT_STYLE: Style = {
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
};
