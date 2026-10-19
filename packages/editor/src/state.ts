import type { Board, Bounds, Camera, Style } from '@kiyora/model';
import type { Point } from './camera';
import type { HistoryState } from './history/stack';
import type { Placement } from './placement';
import type { Selection } from './selection';
import type { Tool } from './tools';

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
  | { kind: 'marquee'; box: Bounds };

/** The open move: the board it began on, where the pointer went down, and the positions it moved from. */
export type MoveDrag = {
  applied: Point;
  before: Board;
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

/** The open gesture, whichever kind it is. */
export type Drag = MoveDrag | MarqueeDrag;

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
   * next shape read one value. The inspector writes it too, through `restyle`.
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
   * The pointer going down on the board. On a shape it selects it — adding to
   * the selection when `additive` — and opens a move; on empty canvas it clears
   * the selection unless `additive`, and opens a marquee.
   */
  pointerDown: (point: Point, additive: boolean) => void;
  /**
   * The pointer moving with a gesture open. A marquee redraws its box; a move
   * translates the whole selection, snapped to the grid unless `bypassSnap`.
   */
  pointerMove: (point: Point, bypassSnap: boolean) => void;
  /** The pointer lifting: a marquee selects what it covers, a move stays put. */
  pointerUp: () => void;
  /** Escape: a move goes back to the positions it started from, a marquee is dropped. */
  cancelGesture: () => void;
  /** Moves every selected shape by the same delta, so relative positions hold. */
  nudge: (dx: number, dy: number) => void;
  /** Ends the open run of nudges, so the next nudge is a fresh history entry. */
  endNudgeRun: () => void;
  /**
   * Restyles every selected shape in one board write: a style patch, an
   * opacity, or both. One call is one gesture, so it is one history entry. The
   * restyled style becomes the one the next shape wears. With an empty
   * selection it does nothing.
   */
  restyle: (change: Restyle) => void;
  /** Whether undo and redo are possible, as a value a control can read. */
  getHistory: () => HistoryState;
  /** Subscribes to history-availability changes. Returns the unsubscribe. */
  subscribeHistory: (listener: () => void) => () => void;
  /** Undoes the last committed gesture. Does nothing when there is none. */
  undo: () => void;
  /** Redoes the last undone gesture. Does nothing when there is none. */
  redo: () => void;
};

/**
 * One style change: part of a shape's style, and the opacity that lives on the
 * shape rather than in the palette.
 */
export type Restyle = {
  opacity?: number;
  style?: Partial<Style>;
};
