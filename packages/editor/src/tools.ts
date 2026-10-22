import type { FigureKind, Style } from '@kiyora/model';

/**
 * What a shape tool places: a figure from the vocabulary, a text shape for
 * words that belong to nothing else, a connector between two ends, a sticky
 * note, an icon from the shipped dataset, a data table with editable cells, or
 * a chart around a starting series. The grammar already names a wireframe
 * figure `table`, so the payload kind and its tool take `data-table` as their
 * token while the product calls it a table.
 */
export type ShapeTool =
  | FigureKind
  | 'text'
  | 'connector'
  | 'sticky'
  | 'icon'
  | 'data-table'
  | 'chart';

/**
 * The two freehand modes a tool arms: a pen lays opaque ink, and a highlighter
 * lays a broad translucent band behind its siblings.
 */
export type InkTool = 'ink' | 'highlighter';

/**
 * What the pointer does on the canvas: `select` picks and moves, `hand` grabs
 * the board itself, `frame` draws a region that holds other shapes, an ink tool
 * draws a stroke, and a shape tool — a figure, text, a connector, a sticky, an
 * icon, a table or a chart — places one when the canvas is dragged.
 */
export type Tool = 'hand' | 'select' | 'frame' | InkTool | ShapeTool;

/** What a tool places on the board: a figure, a text shape, a connector, an icon, a chart or a frame. */
export type Placeable = 'frame' | ShapeTool;

/** Whether `tool` draws freehand ink rather than selecting, panning, framing or placing. */
export const isInkTool = (tool: Tool): tool is InkTool =>
  tool === 'ink' || tool === 'highlighter';

/** Whether `tool` places a shape, rather than selecting, panning, framing or drawing. */
export const isShapeTool = (tool: Tool): tool is ShapeTool =>
  tool !== 'hand' && tool !== 'select' && tool !== 'frame' && !isInkTool(tool);

/** Whether `tool` places a shape on the canvas at all. */
export const placesShape = (tool: Tool): tool is Placeable =>
  tool === 'frame' || isShapeTool(tool);

/** Whether `tool` places a figure, rather than text, a connector, a sticky, an icon, a table, a chart or nothing. */
export const isFigureTool = (tool: Tool): tool is FigureKind =>
  isShapeTool(tool) &&
  tool !== 'text' &&
  tool !== 'connector' &&
  tool !== 'sticky' &&
  tool !== 'icon' &&
  tool !== 'data-table' &&
  tool !== 'chart';

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
