// The board: one schema, one paint walker, and the pure projection to SVG.
export {
  type Board,
  type BoardSettings,
  boardSchema,
  type Camera,
  type Corner,
  cameraSchema,
  cornerSchema,
  DASHES,
  type Dash,
  dashSchema,
  FIGURE_KINDS,
  type FigureKind,
  type FigureShape,
  figureKindSchema,
  SCHEMA_VERSION,
  type Shape,
  type Slide,
  type Style,
  settingsSchema,
  shapeBaseSchema,
  shapeSchema,
  slideSchema,
  styleSchema,
} from './board/schema';
export {
  type BoardIssue,
  BoardRejection,
  boardIssues,
  parseBoard,
} from './board/validate';
export {
  type Bounds,
  boardBounds,
  boundsOf,
  boundsOfShapes,
} from './paint/figures';
export {
  type Paint,
  type PaintContext,
  type PaintPath,
  paintBoard,
  paintShape,
} from './paint/paint';
export {
  FILL_STYLES,
  type FillStyle,
  FOREGROUND,
  FOREGROUND_ENTRY,
  type Foreground,
  fillStyleSchema,
  foregroundSchema,
  PALETTE,
  PALETTE_COLOURS,
  type PaletteColour,
  type PaletteEntry,
  paintColour,
  paletteColourSchema,
  type Theme,
  themeSchema,
} from './paint/palette';
export { projectBoard } from './projection/svg';
