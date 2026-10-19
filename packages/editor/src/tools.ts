import type { FigureKind, Style } from '@kiyora/model';

/**
 * What the pointer does on the canvas: `select` picks and moves, `hand` grabs
 * the board itself, `frame` draws a region that holds other shapes, and a
 * figure kind places one when the canvas is dragged.
 */
export type Tool = 'hand' | 'select' | 'frame' | FigureKind;

/** What a tool places on the board: a figure, or a frame. */
export type Placeable = 'frame' | FigureKind;

/** Whether `tool` places a figure, rather than selecting, panning or framing. */
export const isFigureTool = (tool: Tool): tool is FigureKind =>
  tool !== 'hand' && tool !== 'select' && tool !== 'frame';

/** Whether `tool` places a shape on the canvas at all. */
export const placesShape = (tool: Tool): tool is Placeable =>
  tool === 'frame' || isFigureTool(tool);

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
