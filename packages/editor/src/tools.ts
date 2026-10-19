import type { FigureKind, Style } from '@kiyora/model';

/**
 * What a shape tool places: a figure from the vocabulary, a text shape for
 * words that belong to nothing else, or a sticky note.
 */
export type ShapeTool = FigureKind | 'text' | 'sticky';

/**
 * What the pointer does on the canvas: `select` picks and moves, `hand` grabs
 * the board itself, `frame` draws a region that holds other shapes, and a
 * shape tool — a figure or text — places one when the canvas is dragged.
 */
export type Tool = 'hand' | 'select' | 'frame' | ShapeTool;

/** What a tool places on the board: a figure, a text shape, or a frame. */
export type Placeable = 'frame' | ShapeTool;

/** Whether `tool` places a shape, rather than selecting, panning or framing. */
export const isShapeTool = (tool: Tool): tool is ShapeTool =>
  tool !== 'hand' && tool !== 'select' && tool !== 'frame';

/** Whether `tool` places a shape on the canvas at all. */
export const placesShape = (tool: Tool): tool is Placeable =>
  tool === 'frame' || isShapeTool(tool);

/** Whether `tool` places a figure, rather than a text or sticky shape, or nothing. */
export const isFigureTool = (tool: Tool): tool is FigureKind =>
  isShapeTool(tool) && tool !== 'text' && tool !== 'sticky';

/**
 * The style the first shape wears, and the one place the next shape's style
 * comes from until something — the inspector — changes it. The picker reads the
 * same value as its default, so a board of one colour needs no restyling.
 */
export const DEFAULT_STYLE: Style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
};
