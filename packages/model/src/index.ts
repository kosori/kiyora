// The board: one schema, one paint walker, and the pure projection to SVG.
export {
  type Board,
  type BoardSettings,
  boardSchema,
  type Camera,
  cameraSchema,
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
