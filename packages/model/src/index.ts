// The board: one schema, one paint walker, and the pure projection to SVG.

export {
  MIGRATIONS,
  type Migration,
  type MigrationResult,
  migratePayload,
  versionOf,
} from './board/migrations';
export {
  type Anchor,
  anchorSchema,
  type Board,
  type BoardSettings,
  boardSchema,
  type Camera,
  type ConnectorShape,
  type Corner,
  cameraSchema,
  connectorSchema,
  cornerSchema,
  DASHES,
  type Dash,
  dashSchema,
  EDGES,
  type Edge,
  type Endpoint,
  edgeSchema,
  endpointSchema,
  FIGURE_KINDS,
  type FigureKind,
  type FigureShape,
  FRAME_VARIANTS,
  type FrameShape,
  type FrameVariant,
  figureKindSchema,
  frameSchema,
  frameVariantSchema,
  type Head,
  headSchema,
  ROUTES,
  type Route,
  routeSchema,
  SCHEMA_VERSION,
  type Shape,
  type Slide,
  type StickyShape,
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
  anchorPoint,
  autoAnchor,
  detachConnector,
  moveConnector,
  type ResolvedConnector,
  type ResolvedEnd,
  resolveConnector,
} from './paint/connector-end';
export {
  connectorBounds,
  connectorLabelPoint,
  connectorPath,
  connectorPoints,
} from './paint/connector-route';
export {
  CONNECTOR_REACH,
  type ConnectorInk,
  connectorAt,
  connectorInk,
  connectorLabel,
  HEAD_SIZE,
} from './paint/connectors';
export {
  type Bounds,
  boardBounds,
  boundsOf,
  boundsOfShapes,
  shapeBounds,
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
  DEFAULT_STICKY_SIZE,
  fitSticky,
  NOTE_COLOUR,
  NOTE_STYLE,
} from './paint/sticky';
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
