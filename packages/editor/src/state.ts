import type { Board, Bounds, Camera, Shape, Style } from '@kiyora/model';
import type { Point } from './camera';
import type { HandleKind } from './geometry/handles';
import type { Placement } from './placement';
import type { Restyle } from './restyle';
import type { Selection } from './selection';
import type { Tool } from './tools';

/**
 * The engine's vocabulary: the view, the gesture a pointer is in the middle of,
 * and the engine's own surface. It lives beside `createEditor` so the store
 * file holds only the behaviour, and every type here is the store's contract.
 */

/**
 * Display state: where the board is looked at from, and what the pointer does.
 * It lives beside the document rather than in it, so navigating is never a
 * change to the board, never a history entry, and never a save.
 */
export type View = {
  camera: Camera;
  tool: Tool;
};

/**
 * What a pointer is doing on the board. A gesture lives only while it is open:
 * a move carries the positions to put back, and a marquee carries the box to
 * draw. Neither is in the document, and neither survives the pointer lifting.
 */
export type Gesture =
  | { kind: 'idle' }
  | { kind: 'move' }
  | { kind: 'marquee'; box: Bounds }
  | { kind: 'resize'; handle: HandleKind }
  | { kind: 'rotate' };

/** The open move: where the pointer went down, and the positions it moved from. */
export type MoveDrag = {
  applied: Point;
  kind: 'move';
  originals: ReadonlyMap<string, Point>;
  origin: Point;
  start: Point;
};

/** The open marquee: where it began, what was selected before it, and its box. */
export type MarqueeDrag = {
  additive: boolean;
  base: Selection;
  box: Bounds;
  from: Point;
  kind: 'marquee';
};

/** The open resize: the handle grabbed, the box it started on, and the before-picture. */
export type ResizeDrag = {
  bounds: Bounds;
  handle: HandleKind;
  kind: 'resize';
  originals: ReadonlyMap<string, Shape>;
};

/** The open rotate: where the pointer started, and the before-picture. */
export type RotateDrag = {
  centre: Point;
  kind: 'rotate';
  originals: ReadonlyMap<string, Shape>;
  start: number;
};

/** A pointer's open gesture, in the shape its own kind needs. */
export type Drag = MoveDrag | MarqueeDrag | ResizeDrag | RotateDrag;

/**
 * The engine: it holds one board and its view, and publishes each change to its
 * own subscribers. Nothing here touches the DOM, so a gesture, a command or a
 * migration is proven without a browser.
 */
export type Editor = {
  /** The board as it stands. The same reference until something changes it. */
  getBoard: () => Board;
  /** Replaces the board and notifies every board subscriber. */
  setBoard: (board: Board) => void;
  /** Where the board is looked at from, and what the pointer does. */
  getView: () => View;
  /** The active tool: `getView().tool`, for a surface that only reads the tool. */
  getTool: () => Tool;
  /** Moves the view. The board and the board's subscribers are untouched. */
  setCamera: (camera: Camera) => void;
  /** Changes what the pointer does. The board's subscribers are untouched. */
  setTool: (tool: Tool) => void;
  /** The style the next shape wears: the last used one, or the default. */
  getStyle: () => Style;
  /**
   * Records the style the next shape wears, so the picker's default and the
   * next shape read one value. Nothing observes it yet — the inspector brings
   * the subscription it needs when it lands.
   */
  setStyle: (style: Style) => void;
  /**
   * Places the active tool's shape in `placement`'s box, wearing the last used
   * style, and returns the tool to select. With a tool that places nothing —
   * select or hand — it does nothing.
   */
  placeShape: (placement: Placement) => void;
  /** Subscribes to board changes. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Subscribes to view changes. Returns the unsubscribe. */
  subscribeView: (listener: () => void) => () => void;
  /** The ids of the selected shapes, in paint order. */
  getSelection: () => Selection;
  /** Replaces the selection, keeping only ids the board holds. */
  setSelection: (ids: Selection) => void;
  /** Subscribes to selection changes. Returns the unsubscribe. */
  subscribeSelection: (listener: () => void) => () => void;
  /** What the pointer is doing now: idle, moving, or sweeping a marquee. */
  getGesture: () => Gesture;
  /** Subscribes to gesture changes, so a marquee can be drawn. Returns the unsubscribe. */
  subscribeGesture: (listener: () => void) => () => void;
  /**
   * The pointer going down on the board. On a handle of the current selection it
   * opens a resize or a rotate; on a shape it selects it — adding to the
   * selection when `additive` — and opens a move; on empty canvas it clears the
   * selection unless `additive`, and opens a marquee.
   */
  pointerDown: (point: Point, additive: boolean) => void;
  /**
   * The pointer moving with a gesture open. A marquee redraws its box; a move
   * translates the whole selection, snapped to the grid unless `bypassSnap`; a
   * resize reads `bypassSnap` as alt (grow from the centre) and `shift` as
   * keep-ratio; a rotate reads `shift` as snap-to-fifteen. A resize is always
   * snapped, so alt is the centre modifier here rather than the snap bypass of a
   * move.
   */
  pointerMove: (point: Point, bypassSnap: boolean, shift?: boolean) => void;
  /** The pointer lifting: a marquee selects what it covers, a move stays put. */
  pointerUp: () => void;
  /** Escape: a move goes back to the positions it started from, a marquee is dropped. */
  cancelGesture: () => void;
  /** Moves every selected shape by the same delta, so relative positions hold. */
  nudge: (dx: number, dy: number) => void;
  /**
   * Restyles every selected shape in one board write: a style patch, an
   * opacity, or both. One call is one change, so it becomes one history entry
   * the moment history lands. The restyled style becomes the one the next shape
   * wears. With an empty selection it does nothing.
   */
  restyle: (change: Restyle) => void;
};
