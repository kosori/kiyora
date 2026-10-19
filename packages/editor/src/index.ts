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
  bindingLabel,
  CAMERA_ACTIONS,
  type CameraAction,
  type Chord,
  type Command,
  commandId,
  KEY_ALIASES,
  KEYMAP,
  keyToken,
  type ModifierRule,
  type Modifiers,
  matchBinding,
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
export { type BoardLoad, loadBoard, restoreBoard } from './persistence/board';
export {
  type CorruptReason,
  faultOf,
  StorageError,
  type StorageFault,
} from './persistence/faults';
export {
  createPresence,
  type Presence,
  type PresenceChannel,
  type PresenceMessage,
} from './persistence/presence';
export {
  BOARD_KEY,
  type BoardStorage,
  QUARANTINE_KEY,
  type SaveStatus,
  SNAPSHOT_KEY,
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
export {
  DEFAULT_STYLE,
  isFigureTool,
  isShapeTool,
  type ShapeTool,
  type Tool,
} from './tools';
