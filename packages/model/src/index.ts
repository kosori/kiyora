// The board: one schema, one paint walker, and the pure projection to SVG.

export {
  MIGRATIONS,
  type Migration,
  type MigrationResult,
  migratePayload,
  versionOf,
} from './board/migrations';
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
  FRAME_VARIANTS,
  type FrameShape,
  type FrameVariant,
  figureKindSchema,
  frameSchema,
  frameVariantSchema,
  SCHEMA_VERSION,
  type Shape,
  type Slide,
  type Style,
  settingsSchema,
  shapeBaseSchema,
  shapeSchema,
  slideSchema,
  styleSchema,
  type TextShape,
} from './board/schema';
export {
  type BoardIssue,
  BoardRejection,
  boardIssues,
  parseBoard,
} from './board/validate';
export {
  BOARD_FILE_EXTENSION,
  parseBoardFile,
  serializeBoard,
} from './file/board-file';
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
export {
  deriveWobbleSeed,
  WOBBLE_OPACITY,
  type WobblePoint,
  wobblePath,
} from './paint/wobble';
export { projectBoard } from './projection/svg';
export { CODE_FONT_FAMILY, fontFamilyOf, TEXT_FONT_FAMILY } from './text/font';
export {
  type PaintText,
  TEXT_ASCENT,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING,
  type TextAnchor,
  textAnchorOf,
  textOf,
} from './text/layout';
export {
  parseRuns,
  type Run,
  sameRunStyle,
  sanitizeHref,
} from './text/markdown';
export {
  DEFAULT_TEXT_STYLE,
  TEXT_ALIGNS,
  TEXT_SIZE_PRESETS,
  TEXT_SIZES,
  TEXT_VALIGNS,
  type TextAlign,
  type TextStyle,
  type TextVerticalAlign,
  textStyleSchema,
} from './text/style';
export {
  type MeasureRun,
  type Measurer,
  type TextLine,
  wrapRuns,
} from './text/wrap';
