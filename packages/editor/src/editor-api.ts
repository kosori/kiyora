import type {
  Board,
  Camera,
  ImageShape,
  Measurer,
  Shape,
  Style,
  TextStyle,
  Theme,
} from '@kiyora/model';
import type { Alignment, DistributeAxis } from './align';
import type { Point } from './camera';
import type { ChartEdit } from './chart';
import type { Clipboard } from './clipboard';
import type { ConnectorEdit } from './connectors';
import type { HistoryState } from './history/stack';
import type { GestureModifiers } from './modifiers';
import type { NavigationDirection } from './navigation';
import type { ImagePlacement, Placement } from './placement';
import type { Restyle } from './restyle';
import type { Selection } from './selection';
import type { SourceApply } from './source-commands';
import type { Gesture, PresentState, View } from './state';
import type { Tool } from './tools';

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
  /**
   * Arms the canvas to place one icon from the shipped dataset. The name lives
   * in the view until a gesture places it, so nothing derived reaches the board
   * and choosing an icon is never a history entry.
   */
  setIcon: (name: string) => void;
  /**
   * Shows or hides the chrome, leaving the board alone on screen. Zen is a view
   * setting: it wakes the view's subscribers, never the board's, so it writes
   * nothing, costs no history entry and saves nothing. Escape leaves it.
   */
  setZen: (zen: boolean) => void;
  /** Enters or leaves shape-navigation mode: a view flag, with the board, its history and its saves untouched. */
  setNavigating: (navigating: boolean) => void;
  /** Steps the selection to the nearest shape that way by geometry, or nowhere when nothing lies there. */
  navigate: (direction: NavigationDirection) => void;
  /** The style the next shape wears: the last used one, or the default. */
  getStyle: () => Style;
  /**
   * Records the style the next shape wears, so the picker's default and the
   * next shape read one value. The inspector writes it too, through `restyle`.
   */
  setStyle: (style: Style) => void;
  /**
   * Places the active shape tool's shape in `placement`'s box, wearing the last
   * used style, and returns it so a caller can begin editing a text shape at
   * once, or `null` for a tool that places nothing.
   */
  placeShape: (placement: Placement) => Shape | null;
  /**
   * Places one image in `placement`'s box and stores its raster under its
   * content hash. The picture and the shape land as one change, so one undo
   * takes both back; an id the board already holds is reused, so placing the
   * same bytes again adds a shape and not a second payload.
   */
  placeImage: (placement: ImagePlacement) => ImageShape;
  /**
   * Replaces one shape's label, or its text style. Each is one board change and
   * one history entry. A sticky grows to fit its label when a measurer is
   * supplied, so its box stays the truth a selection, a click and an export all
   * read; the box travels with the words, so one undo puts both back. A write
   * between `beginTextEdit` and `endTextEdit` joins that edit instead of
   * committing on its own.
   */
  setText: (id: string, text: string, measure?: Measurer) => void;
  setTextStyle: (id: string, textStyle: TextStyle) => void;
  /**
   * Applies diagram source to the frame `frameId` names. The shapes its last
   * Source generated are replaced, the new ones join the frame, and the text is
   * stored with them so the next open shows what was typed. One call is one
   * gesture, so one undo takes the whole apply back; a frame with no Source
   * applies an empty text without complaint.
   *
   * A stale frame is left exactly as it was unless `force` is set, and the
   * result says so, so a caller can ask before discarding a hand edit. Shapes
   * inside the frame that the Source did not generate always survive.
   */
  applySource: (
    frameId: string,
    text: string,
    options?: { force?: boolean }
  ) => SourceApply;
  /**
   * Opens the label edit's transaction, so every write between this and
   * `endTextEdit` is one gesture and one history entry. Joins one already open —
   * a placed text shape hands its own transaction to the overlay — so a
   * placement and the label typed into it are not two undos.
   */
  beginTextEdit: () => void;
  /** Commits the open label edit as one entry. Does nothing when none is open. */
  endTextEdit: () => void;
  /**
   * Drops the open label edit and restores the board it began on, pushing
   * nothing, so Escape costs no undo.
   */
  cancelTextEdit: () => void;
  /**
   * Changes a connector's route or the head at one end. One call is one
   * gesture, so it is one history entry. A shape that is not a connector, or an
   * edit that changes nothing, leaves the board alone.
   */
  setConnector: (id: string, edit: ConnectorEdit) => void;
  /**
   * Replaces a chart's series, labels, palette or kind as one gesture, so one
   * undo returns the data. A chart is stored as numbers, not as a picture of
   * them; a shape that is not a chart, or an edit that changes nothing, leaves
   * the board alone.
   */
  setChart: (id: string, edit: ChartEdit) => void;
  /**
   * Deletes the selection and everything it holds. A connector bound to a
   * deleted shape is kept and its end freed where it attached, so nothing
   * vanishes silently. One gesture, one history entry.
   */
  deleteSelection: () => void;
  /** Copies the selection to the app's clipboard. Changes nothing on the board. */
  copy: () => void;
  /**
   * Whether the clipboard holds a fragment, so a surface can disable a paste
   * rather than offer one that does nothing. Reads display state only.
   */
  canPaste: () => boolean;
  /** Copies the selection and deletes it as one gesture, so one undo restores both. */
  cut: () => void;
  /** Copies the selection clear of itself. One board change, one history entry. */
  duplicate: () => void;
  /**
   * Brings the selection's roots together in one group, whose box is derived
   * from them. One board change, one history entry.
   */
  groupSelection: () => void;
  /**
   * Takes the selected groups apart, leaving every member exactly where it was.
   * One board change, one history entry.
   */
  ungroupSelection: () => void;
  /**
   * Lines the selection up to one edge or centre of its own box. A Connector is
   * not an item alignment arranges — its bound ends follow the shapes that move
   * — and a Group travels as the members its derived box holds. A locked shape
   * stays put. One call is one gesture; an alignment that would move nothing
   * writes nothing, so a no-op never lands in undo.
   */
  align: (alignment: Alignment) => void;
  /**
   * Spaces three or more movable selected shapes evenly along `axis`, keeping
   * the outermost two where they are. One call is one gesture, and a selection
   * already spaced evenly writes nothing.
   */
  distribute: (axis: DistributeAxis) => void;
  /**
   * Puts the clipboard on the board offset clear of what it copies, cascading
   * further on each repeat so a second paste is not hidden by the first. One
   * gesture however many shapes it carries, so one undo takes the paste back.
   */
  paste: () => void;
  /**
   * Takes a fragment copied in another tab as this tab's clipboard. The next
   * paste re-ids it against this board, exactly as a copy made here would; the
   * board is untouched until then.
   */
  receiveClipboard: (fragment: Clipboard) => void;
  /** Subscribes to copies made here, so a tab can share them over the board channel. */
  subscribeClipboard: (listener: (fragment: Clipboard) => void) => () => void;
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
   * The pointer going down. A handle opens a resize or rotate; a shape selects
   * and opens a move; empty canvas clears and opens a marquee. An ink tool opens
   * a stroke, and `pressure` is what the device reported. `includeLocked`
   * reaches a locked shape, so alt-clicking one selects it for the Inspector.
   */
  pointerDown: (
    point: Point,
    additive: boolean,
    includeLocked?: boolean,
    pressure?: number
  ) => void;
  /**
   * The pointer moving with a gesture open. A marquee redraws its box; a move,
   * a resize and a rotate read the one `modifiers` value; an ink stroke appends
   * the sample and its pressure. Alt bypasses snapping and grows a resize from
   * its centre; shift keeps a resize's ratio and snaps a rotation to fifteen.
   * See `modifiers.ts`.
   */
  pointerMove: (
    point: Point,
    modifiers: GestureModifiers,
    pressure?: number
  ) => void;
  /** The pointer lifting: a marquee selects what it covers, a move stays put. */
  pointerUp: () => void;
  /** Escape: a move goes back to the positions it started from, a marquee is dropped. */
  cancelGesture: () => void;
  /** Moves every selected shape by the same delta, so relative positions hold. */
  nudge: (dx: number, dy: number) => void;
  /** Ends the open run of nudges, so the next nudge is a fresh history entry. */
  endNudgeRun: () => void;
  /**
   * Puts the selection in front of its siblings in paint order. A frame's
   * member moves inside its frame, and a group moves with its members. One
   * board change, one history entry; nothing is written when it is already
   * there.
   */
  bringToFront: () => void;
  /** Puts the selection behind its siblings in paint order. One history entry. */
  sendToBack: () => void;
  /**
   * Raises the selection one place in its sibling list, moving a multi-selection
   * as one block. One board change, one history entry; nothing is written when
   * it cannot step.
   */
  bringForward: () => void;
  /** Lowers the selection one place in its sibling list. One history entry. */
  sendBackward: () => void;
  /**
   * Restyles every selected shape in one board write: a style patch, an
   * opacity, a text-style patch, or any combination. One call is one gesture,
   * so it is one history entry. A restyled style becomes the one the next shape
   * wears; a text-only change leaves it alone. With an empty selection it does
   * nothing.
   */
  restyle: (change: Restyle) => void;
  /**
   * Locks or unlocks every selected shape in one board write. One call is one
   * gesture, so it is one history entry; a selection already wearing the asked-for
   * lock writes nothing. A locked shape still resists every transform.
   */
  setLocked: (locked: boolean) => void;
  /**
   * Sets the board's theme — the canvas it is authored and exported on. One
   * board change, one history entry; a board already wearing the theme writes
   * nothing. The chrome's appearance is not this: it never reaches the board.
   */
  setTheme: (theme: Theme) => void;
  /** Whether undo and redo are possible, as a value a control can read. */
  getHistory: () => HistoryState;
  /** Subscribes to history-availability changes. Returns the unsubscribe. */
  subscribeHistory: (listener: () => void) => () => void;
  /** Undoes the last committed gesture. Does nothing when there is none. */
  undo: () => void;
  /** Redoes the last undone gesture. Does nothing when there is none. */
  redo: () => void;
  /** Presentation: whether it is active, which slide shows, and which overlays are up. */
  getPresent: () => PresentState;
  /** Subscribes to presentation changes. Returns the unsubscribe. */
  subscribePresent: (listener: () => void) => () => void;
  /** Starts presenting at the first slide presenting plays. Does nothing with none. */
  startPresent: () => void;
  /** Leaves presenting and returns to editing. Changes nothing on the board. */
  stopPresent: () => void;
  /** Advances one slide, clamped at the last, so a held key cannot run off the deck. */
  nextSlide: () => void;
  /** Steps back one slide, clamped at the first. */
  previousSlide: () => void;
  /** Shows or hides the notes overlay while presenting. */
  toggleNotes: () => void;
  /** Shows or hides the timer overlay while presenting. */
  toggleTimer: () => void;
  /** Makes a frame a slide: one board change, one history entry. */
  addSlide: (frameId: string) => void;
  /** Plants a template as a new slide: one board change, one history entry. */
  addSlideFromTemplate: (templateId: string) => void;
  /** Duplicates a slide with its frame and members: one board change. */
  duplicateSlide: (frameId: string) => void;
  /** Deletes a slide and the frame it showed: one board change. */
  deleteSlide: (frameId: string) => void;
  /** Moves a slide to deck position `to`: one board change. */
  moveSlide: (frameId: string, to: number) => void;
  /** Replaces one slide's notes: one board change, one history entry. */
  setSlideNotes: (frameId: string, notes: string) => void;
  /** Skips or unskips one slide: one board change, without deleting the frame. */
  toggleSlideSkip: (frameId: string) => void;
};
