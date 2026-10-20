// The engine: the store, the gestures, the history, the hit-testing, the persistence.

export { subtreeIds } from '@kiyora/model';
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
  visibleBounds,
  wheelZoom,
  ZOOM_STEP,
  zoomAt,
  zoomBy,
} from './camera';
export {
  type Clipboard,
  COPY_OFFSET,
  copyFragment,
  duplicateShapes,
  type Paste,
  pasteFragment,
} from './clipboard';
export {
  CAMERA_ACTIONS,
  type CameraAction,
  type Command,
  commandId,
} from './commands';
export {
  type ConnectorEdit,
  editConnector,
  removeShapes,
} from './connectors';
export {
  addShape,
  frameAround,
  frameIds,
  isFrame,
  memberIds,
  parentFrame,
  setMembership,
} from './containment';
export {
  type CommandHost,
  type CommandTarget,
  DISPATCHED_KINDS,
  runCommand,
} from './dispatch';
export {
  HANDLE_REACH,
  HANDLE_SIZE,
  HANDLES,
  type Handle,
  type HandleKind,
  type HandleSigns,
  handleAt,
  handlePositions,
  handleSigns,
  MIN_SIZE,
  type ResizeModifiers,
  ROTATE_DISTANCE,
  ROTATION_SNAP,
  ROTATION_ZERO,
  resizeBounds,
  resizeModifiers,
  rotateHandlePosition,
} from './geometry/handles';
export {
  boxBetween,
  boxesIntersect,
  containsPoint,
  shapeAt,
  shapesInBox,
} from './geometry/hit-test';
export { GRID, NUDGE_STEP, snapTranslation, snapValue } from './geometry/snap';
export {
  createHistory,
  HISTORY_LIMIT,
  type History,
  type HistoryState,
} from './history/stack';
export {
  type Binding,
  type Chord,
  KEY_ALIASES,
  KEY_MODES,
  KEYMAP,
  type KeyMode,
  keyToken,
  type ModifierRule,
  type Modifiers,
  matchBinding,
  matchKey,
  resolveKey,
  SHORTCUT_ROWS,
  type ShortcutRow,
} from './keymap';
export {
  GESTURE_REFERENCE,
  type GestureModifiers,
  type GestureReferenceRow,
  gestureModifiers,
  type ModifierSource,
  NO_GESTURE_MODIFIERS,
} from './modifiers';
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
export { DEFAULT_FRAME_SIZE, DEFAULT_SHAPE_SIZE } from './placement';
export type { Restyle } from './restyle';
export {
  normaliseSelection,
  type Offsets,
  offsetShapes,
  type Selection,
  selectedShapes,
  selectionBounds,
} from './selection';
export {
  bindingKey,
  bindingLabel,
  type ReferenceRow,
  shortcutReference,
} from './shortcut-reference';
export {
  createEditor,
  type Editor,
  type Gesture,
  type PresentState,
  type View,
} from './store';
export {
  DEFAULT_STYLE,
  isFigureTool,
  isShapeTool,
  type Placeable,
  placesShape,
  type ShapeTool,
  type Tool,
} from './tools';
export {
  angleAt,
  type Replacements,
  ROTATED_SCALE_REFUSAL,
  resizeRefusal,
  resizeSelection,
  rotateSelection,
  settleRotation,
} from './transform';
