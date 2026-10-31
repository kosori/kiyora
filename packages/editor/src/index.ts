// The engine: the store, the gestures, the history, the hit-testing, the persistence.

export { subtreeIds } from '@kiyora/model';
export {
  ALIGNMENTS,
  type Alignment,
  type Arrangement,
  alignBoard,
  arrangeableShapes,
  arrangementOf,
  DISTRIBUTE_AXES,
  type DistributeAxis,
  distributeBoard,
} from './align';
export {
  clampZoom,
  FIT_PADDING,
  FOCUS_ZOOM,
  fitCamera,
  focusCamera,
  GRID_BASE_STEP,
  gridSpacing,
  gridStep,
  MAX_ZOOM,
  MIN_GRID_SPACING,
  MIN_ZOOM,
  type Point,
  panBy,
  REVEAL_MARGIN,
  resetCamera,
  revealCamera,
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
export { type ChartEdit, editChart } from './chart';
export {
  CLIPBOARD_VERSION,
  type Clipboard,
  type ClipboardMessage,
  COPY_OFFSET,
  clipboardMessage,
  copyFragment,
  duplicateShapes,
  type Paste,
  pasteFragment,
  portableFragment,
  readClipboardMessage,
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
  type ContainerShape,
  frameAround,
  frameIds,
  isContainer,
  isFrame,
  isGroup,
  memberIds,
  outermostGroup,
  parentContainer,
  setMembership,
} from './containment';
export {
  type ContextMenuItem,
  type ContextMenuSection,
  type ContextMenuState,
  contextMenu,
} from './context-menu';
export {
  type CommandHost,
  type CommandTarget,
  DISPATCHED_KINDS,
  runCommand,
} from './dispatch';
export { findMatches } from './find';
export {
  type AlignmentLine,
  alignmentLines,
  type BoxSnap,
  GUIDE_TOLERANCE,
  type Guide,
  type GuideAxis,
  guideAcross,
  nearestLine,
  sameGuides,
  snapBox,
} from './geometry/guides';
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
  NAVIGATION_DIRECTIONS,
  type NavigationDirection,
  nextShape,
} from './navigation';
export {
  AUTOSAVE_DELAY,
  type Autosave,
  type AutosaveOptions,
  createAutosave,
  type SavedBoard,
  savedBoard,
} from './persistence/autosave';
export { type BoardLoad, loadBoard, restoreBoard } from './persistence/board';
export {
  type ClipboardRelay,
  createClipboardRelay,
} from './persistence/clipboard-channel';
export {
  type CorruptReason,
  faultOf,
  StorageError,
  type StorageFault,
} from './persistence/faults';
export {
  adoptLegacyBoard,
  createLibrary,
  type Library,
  type LibraryEntry,
  type LibraryRecord,
  type LibrarySyncRecord,
} from './persistence/library';
export {
  type BoardChannel,
  type BoardMessage,
  createPresence,
  type Presence,
  type PresenceMessage,
} from './persistence/presence';
export {
  BOARD_PREFIX,
  type BoardStorage,
  boardKey,
  boardQuarantineKey,
  boardSnapshotKey,
  boardStorage,
  type KeyValueStore,
  LEGACY_BOARD_KEY,
  LEGACY_QUARANTINE_KEY,
  LEGACY_SNAPSHOT_KEY,
  LIBRARY_KEY,
  type SaveStatus,
} from './persistence/storage';
export type { Placement } from './placement';
export {
  DEFAULT_CHART_SIZE,
  DEFAULT_FRAME_SIZE,
  DEFAULT_SHAPE_SIZE,
} from './placement';
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
  commandKeyFor,
  commandPalette,
  keyshortcutsFor,
  type PaletteEntry,
  type Platform,
  type ReferenceRow,
  shortcutReference,
} from './shortcut-reference';
export type { SourceApply, SourceApplyOptions } from './source-commands';
export {
  markSourceStale,
  type SourceState,
  sourceState,
} from './source-state';
export {
  createEditor,
  type Editor,
  type Gesture,
  type ImagePlacement,
  type PresentState,
  type View,
} from './store';
export {
  DEFAULT_STYLE,
  type InkTool,
  isFigureTool,
  isInkTool,
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
