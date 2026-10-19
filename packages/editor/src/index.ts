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
export { createEditor, type Editor, type View } from './store';
export { DEFAULT_STYLE, isFigureTool, type Tool } from './tools';
