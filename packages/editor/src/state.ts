import type { Board, Bounds, Camera, Shape } from '@kiyora/model';
import type { Point } from './camera';
import type { AlignmentLine, Guide } from './geometry/guides';
import type { HandleKind } from './geometry/handles';
import type { InkDrag } from './ink';
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
  /**
   * The icon a pending icon tool will place. It lives beside the tool rather
   * than in the document: choosing an icon arms the canvas, and the name only
   * becomes authored state once the gesture places a shape.
   */
  icon: string | null;
  /** Whether the chrome is hidden, so the board is left alone on screen. */
  zen: boolean;
  /** Whether the canvas is stepping the selection spatially: a view flag, never a board write. */
  navigating: boolean;
};

/**
 * What a pointer is doing on the board. A gesture lives only while it is open:
 * a move carries the positions to put back, and a marquee carries the box to
 * draw. Neither is in the document, and neither survives the pointer lifting.
 */
export type Gesture =
  | { kind: 'idle' }
  | { guides: readonly Guide[]; kind: 'move' }
  | { kind: 'marquee'; box: Bounds }
  | {
      guides: readonly Guide[];
      handle: HandleKind;
      kind: 'resize';
      refusal?: string;
    }
  | { kind: 'rotate' }
  | { kind: 'ink' };

/**
 * The open move: the board it began on, where the pointer went down, the box it
 * started on, and the positions it moved from. The alignment lines are read
 * once, from the board it began on, so a pointer move never rescans the board.
 */
export type MoveDrag = {
  applied: Point;
  before: Board;
  box: Bounds;
  guides: readonly Guide[];
  kind: 'move';
  lines: readonly AlignmentLine[];
  originals: ReadonlyMap<string, Point>;
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

/** The open resize: the board it began on, the handle grabbed, and the before-picture. */
export type ResizeDrag = {
  before: Board;
  bounds: Bounds;
  guides: readonly Guide[];
  handle: HandleKind;
  kind: 'resize';
  lines: readonly AlignmentLine[];
  originals: ReadonlyMap<string, Shape>;
  /** Why the current pointer position is refused, or absent when it scales exactly. */
  refusal?: string;
};

/** The open rotate: the board it began on, where the pointer started, and the before-picture. */
export type RotateDrag = {
  before: Board;
  centre: Point;
  kind: 'rotate';
  originals: ReadonlyMap<string, Shape>;
  start: number;
};

/** A pointer's open gesture, in the shape its own kind needs. */
export type Drag = MoveDrag | MarqueeDrag | ResizeDrag | RotateDrag | InkDrag;

/**
 * Presentation: display state, never the board. Presenting reads the deck and
 * shows one slide at a time; nothing here writes, so a slide show leaves no
 * history entry and arms no save.
 */
export type PresentState = {
  active: boolean;
  /** The deck position shown, counted over the slides presenting plays. */
  index: number;
  /** Whether the notes overlay is up. */
  notes: boolean;
  /** Whether the timer overlay is up. */
  timer: boolean;
};

export type { Editor } from './editor-api';
