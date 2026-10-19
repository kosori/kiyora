import type { FigureKind, Style } from '@kiyora/model';

/**
 * What a shape tool places: a figure from the vocabulary, or a text shape for
 * words that belong to nothing else.
 */
export type ShapeTool = FigureKind | 'text';

/**
 * What the pointer does on the canvas: `select` picks and moves, `hand` grabs
 * the board itself, and a shape tool places one when the canvas is dragged.
 */
export type Tool = 'hand' | 'select' | ShapeTool;

/** Whether `tool` places a shape, rather than selecting or panning. */
export const isShapeTool = (tool: Tool): tool is ShapeTool =>
  tool !== 'hand' && tool !== 'select';

/** Whether `tool` places a figure, rather than a text shape or nothing. */
export const isFigureTool = (tool: Tool): tool is FigureKind =>
  isShapeTool(tool) && tool !== 'text';

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
