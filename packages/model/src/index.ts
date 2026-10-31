// The board: one schema, one paint walker, and the pure projection to SVG.

export {
  CHART_KINDS,
  CHART_LABELS,
  CHART_PALETTE,
  CHART_SERIES,
  type ChartKind,
  type ChartShape,
  chartKindSchema,
  chartSchema,
  MAX_CHART_VALUES,
} from './board/chart';
export {
  type BoardFiles,
  filesSchema,
  fitImageSize,
  hasImageFiles,
  IMAGE_FILE_LIMIT_BYTES,
  IMAGE_MAX_SIDE,
  IMAGE_MIME_TYPES,
  type ImageFile,
  type ImageMime,
  imageFileSchema,
  imageMimeOf,
  imageMimeSchema,
} from './board/image';
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
  cameraSchema,
  connectorSchema,
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
  type GroupShape,
  groupSchema,
  type Head,
  headSchema,
  type IconShape,
  type ImageShape,
  INK_MODES,
  type InkMode,
  type InkPoint,
  type InkShape,
  iconSchema,
  imageSchema,
  inkModeSchema,
  inkPointSchema,
  inkSchema,
  ROUTES,
  type Route,
  routeSchema,
  SCHEMA_VERSION,
  type Shape,
  type Slide,
  type Source,
  STICKY_FITS,
  type StickyFit,
  type StickyShape,
  settingsSchema,
  shapeSchema,
  slideSchema,
  sourceSchema,
  stickyFitSchema,
  type TextShape,
} from './board/schema';
export type { Corner, Dash, Style } from './board/shape-base';
export {
  cornerSchema,
  DASHES,
  dashSchema,
  shapeBaseSchema,
  styleSchema,
} from './board/shape-base';
export { type TableShape, tableSchema } from './board/table';
export {
  type BoardIssue,
  BoardRejection,
  boardIssues,
  parseBoard,
} from './board/validate';
export { mapSource, SOURCE_INSET, type SourceMapping } from './bridge/mapping';
export {
  type ChartSlice,
  type ChartSpan,
  type ChartTick,
  chartSlices,
  chartSpan,
  chartTicks,
  fractionOf,
  textWidth,
  truncateToWidth,
  widestOf,
} from './chart/scale';
export {
  addSlide,
  DECK_TEMPLATES,
  type DeckEntry,
  type DeckTemplate,
  deckFrames,
  deleteSlide,
  duplicateSlide,
  framesWithoutSlide,
  insertTemplateSlide,
  moveSlide,
  nextId,
  presentedSlides,
  setSlideNotes,
  subtreeIds,
  type TemplatePiece,
  toggleSlideSkipped,
} from './deck';
export {
  exportBoardSvg,
  SVG_EXPORT_LIMIT_BYTES,
  SVG_FILE_EXTENSION,
  type SvgExportOptions,
  SvgExportRefusal,
  unsafeSvg,
} from './export/board-svg';
export {
  BOARD_FILE_EXTENSION,
  BOARD_FILE_LIMIT_BYTES,
  BoardFileFault,
  parseBoardFile,
  serializeBoard,
} from './file/board-file';
export { utf8Length } from './format';
export { ICON_VIEWBOX, type IconSet } from './icons/icon-set';
export {
  addStrokePoint,
  INK_HIGHLIGHTER_ALPHA,
  INK_HIGHLIGHTER_SCALE,
  INK_MIN_STEP,
  INK_REACH,
  type InkStrokePoint,
  inkAt,
  inkFromStroke,
  inkMargin,
  inkPath,
  inkPoints,
  inkWidths,
  MAX_INK_POINTS,
  simplifyStroke,
} from './ink/ink';
export {
  DEFAULT_LAYOUT_DIRECTION,
  type GroupPlacement,
  LAYOUT_DIRECTIONS,
  LAYOUT_GAP,
  LAYOUT_INSET,
  LAYOUT_NODE,
  LAYOUT_RANK_GAP,
  type Layout,
  type LayoutDirection,
  type LayoutOptions,
  layoutGraph,
  type NodePlacement,
} from './layout/layered';
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
export type { PaintImage } from './paint/image';
export {
  type Paint,
  type PaintContext,
  type PaintPath,
  paintBoard,
  paintShape,
} from './paint/paint';
export {
  CANVAS_ENTRY,
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
  MIN_STICKY_HEIGHT,
  NOTE_COLOUR,
  NOTE_STYLE,
} from './paint/sticky';
export { type Point, turn } from './paint/turn';
export {
  PREVIEW_LIMIT_BYTES,
  PREVIEW_WIDTH,
  type PreviewOptions,
  previewBoard,
} from './preview/preview';
export {
  type ProjectionOptions,
  projectBoard,
} from './projection/svg';
export {
  DEFAULT_TABLE_COLUMNS,
  DEFAULT_TABLE_ROWS,
  DEFAULT_TABLE_SIZE,
  emptyTableRows,
  type TableCell,
  type TableCellBox,
  tableCellAt,
  tableCellBox,
  tableCellText,
  tableWithCellText,
  tableWithColumn,
  tableWithHeader,
  tableWithRow,
} from './table/table';
export { CODE_FONT_FAMILY, fontFamilyOf, TEXT_FONT_FAMILY } from './text/font';
export {
  type PaintText,
  TEXT_ASCENT,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING,
  type TextAnchor,
  type TextBox,
  type TextBoxOptions,
  textAnchorOf,
  textInBox,
  textOf,
} from './text/layout';
export {
  caretInCode,
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
