// The engine: the store, the gestures, the history, the hit-testing, the persistence.
export {
  clampZoom,
  FIT_PADDING,
  fitCamera,
  GRID_BASE_STEP,
  gridSpacing,
  gridStep,
  MAX_ZOOM,
  MIN_GRID_SPACING,
  MIN_ZOOM,
  type Point,
  panBy,
  resetCamera,
  stepZoom,
  toScreen,
  toWorld,
  type Viewport,
  viewCentre,
  wheelZoom,
  ZOOM_STEP,
  zoomAt,
  zoomBy,
} from './camera';
export {
  boxBetween,
  boxesIntersect,
  containsPoint,
  shapeAt,
  shapesInBox,
} from './geometry/hit-test';
export { GRID, NUDGE_STEP, snapTranslation, snapValue } from './geometry/snap';
export {
  type Binding,
  bindingKey,
  CAMERA_ACTIONS,
  type CameraAction,
  type Command,
  commandId,
  KEY_ALIASES,
  KEYMAP,
  keyToken,
  type ReferenceRow,
  resolveKey,
  SHORTCUT_ROWS,
  type ShortcutRow,
  shortcutReference,
} from './keymap';
export {
  AUTOSAVE_DELAY,
  type Autosave,
  type AutosaveOptions,
  createAutosave,
} from './persistence/autosave';
export { loadBoard, restoreBoard } from './persistence/board';
export {
  BOARD_KEY,
  type BoardStorage,
  type SaveStatus,
} from './persistence/storage';
export type { Placement } from './placement';
export {
  normaliseSelection,
  type Offsets,
  offsetShapes,
  type Selection,
  selectedShapes,
  selectionBounds,
} from './selection';
export {
  createEditor,
  type Editor,
  type Gesture,
  type View,
} from './store';
export { DEFAULT_STYLE, isFigureTool, type Tool } from './tools';
