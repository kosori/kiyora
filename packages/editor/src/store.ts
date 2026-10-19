import type {
  Board,
  Bounds,
  Camera,
  Shape,
  Style,
  TextStyle,
} from '@kiyora/model';
import type { Point } from './camera';
import { boxBetween, shapeAt, shapesInBox } from './geometry/hit-test';
import { snapTranslation } from './geometry/snap';
import { type Placement, shapeFromPlacement } from './placement';
import {
  normaliseSelection,
  offsetShapes,
  type Selection,
  selectedShapes,
} from './selection';
import { setShapeText, setShapeTextStyle } from './shape-edit';
import { DEFAULT_STYLE, isShapeTool, type Tool } from './tools';

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

/** The open move: where the pointer went down, and the positions it moved from. */
type MoveDrag = {
  applied: Point;
  kind: 'move';
  originals: ReadonlyMap<string, Point>;
  origin: Point;
  start: Point;
};

/** The open marquee: where it began, what was selected before it, and its box. */
type MarqueeDrag = {
  additive: boolean;
  base: Selection;
  box: Bounds;
  from: Point;
  kind: 'marquee';
};

type Drag = MoveDrag | MarqueeDrag;

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
  /** Places the active shape tool's shape in `placement`'s box, and returns it or `null`. */
  placeShape: (placement: Placement) => Shape | null;
  /** Replaces one shape's label, or its text style. Each is one board change. */
  setText: (id: string, text: string) => void;
  setTextStyle: (id: string, textStyle: TextStyle) => void;
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
};

/** An engine over `board`, holding it and publishing each replacement. */
export const createEditor = (board: Board): Editor => {
  let current = board;
  let view: View = { camera: board.camera, tool: 'select' };
  let style: Style = DEFAULT_STYLE;
  let selection: Selection = [];
  let drag: Drag | null = null;
  let cachedDrag: Drag | null = null;
  let cachedGesture: Gesture = { kind: 'idle' };
  const listeners = new Set<() => void>();
  const viewListeners = new Set<() => void>();
  const selectionListeners = new Set<() => void>();
  const gestureListeners = new Set<() => void>();

  const publish = (set: Set<() => void>): void => {
    for (const listener of set) {
      listener();
    }
  };

  const setView = (next: View): void => {
    view = next;
    publish(viewListeners);
  };

  const publishGesture = (): void => {
    publish(gestureListeners);
  };

  /**
   * The gesture as a value, memoised on the drag it came from: two reads with
   * nothing in between must see the same object, or a snapshot subscription
   * that compares references would loop forever.
   */
  const gestureNow = (): Gesture => {
    if (drag !== cachedDrag) {
      cachedDrag = drag;
      cachedGesture =
        drag === null
          ? { kind: 'idle' }
          : drag.kind === 'move'
            ? { kind: 'move' }
            : { box: drag.box, kind: 'marquee' };
    }
    return cachedGesture;
  };

  /** Keeps only ids the board holds, in paint order, and publishes a real change. */
  const commitSelection = (next: Selection): void => {
    const ids = normaliseSelection(current, next);
    const same =
      ids.length === selection.length &&
      ids.every((id, index) => id === selection[index]);
    if (same) {
      return;
    }
    selection = ids;
    publish(selectionListeners);
  };

  const positionsOf = (
    shapes: readonly { id: string; x: number; y: number }[]
  ) => new Map(shapes.map((shape) => [shape.id, { x: shape.x, y: shape.y }]));

  /** Opens a move over the current selection, if it holds anything. */
  const beginMove = (point: Point): void => {
    const shapes = selectedShapes(current, selection);
    if (shapes.length === 0) {
      return;
    }
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    for (const shape of shapes) {
      left = Math.min(left, shape.x);
      top = Math.min(top, shape.y);
    }
    drag = {
      applied: { x: 0, y: 0 },
      kind: 'move',
      origin: { x: left, y: top },
      originals: positionsOf(shapes),
      start: point,
    };
    publishGesture();
  };

  /** Puts every moved shape back where the gesture found it. */
  const restoreMove = (move: MoveDrag): void => {
    const offsets = new Map<string, Point>();
    for (const [id, position] of move.originals) {
      offsets.set(id, position);
    }
    current = offsetShapes(current, offsets);
    publish(listeners);
  };

  return {
    cancelGesture: () => {
      if (drag === null) {
        return;
      }
      const open = drag;
      drag = null;
      if (open.kind === 'move') {
        if (open.applied.x !== 0 || open.applied.y !== 0) {
          restoreMove(open);
        }
      } else {
        commitSelection(open.base);
      }
      publishGesture();
    },
    getBoard: () => current,
    getGesture: gestureNow,
    getSelection: () => selection,
    getStyle: () => style,
    getTool: () => view.tool,
    getView: () => view,
    nudge: (dx, dy) => {
      const shapes = selectedShapes(current, selection);
      if (shapes.length === 0) {
        return;
      }
      const offsets = positionsOf(shapes);
      for (const [id, position] of offsets) {
        offsets.set(id, { x: position.x + dx, y: position.y + dy });
      }
      current = offsetShapes(current, offsets);
      publish(listeners);
    },
    placeShape: (placement) => {
      const { tool } = view;
      if (!isShapeTool(tool)) {
        return null;
      }
      const shape = shapeFromPlacement(tool, placement, style, current.shapes);
      current = { ...current, shapes: [...current.shapes, shape] };
      setView({ ...view, tool: 'select' });
      publish(listeners);
      return shape;
    },
    pointerDown: (point, additive) => {
      const hit = shapeAt(current.shapes, point);
      if (hit === null) {
        drag = {
          additive,
          base: selection,
          box: boxBetween(point, point),
          from: point,
          kind: 'marquee',
        };
        if (!additive) {
          commitSelection([]);
        }
        publishGesture();
        return;
      }
      if (additive) {
        commitSelection(
          selection.includes(hit.id)
            ? selection.filter((id) => id !== hit.id)
            : [...selection, hit.id]
        );
      } else if (!selection.includes(hit.id)) {
        commitSelection([hit.id]);
      }
      if (selection.includes(hit.id)) {
        beginMove(point);
      }
    },
    pointerMove: (point, bypassSnap) => {
      if (drag === null) {
        return;
      }
      if (drag.kind === 'marquee') {
        drag = { ...drag, box: boxBetween(drag.from, point) };
        publishGesture();
        return;
      }
      let dx = point.x - drag.start.x;
      let dy = point.y - drag.start.y;
      if (!bypassSnap) {
        dx = snapTranslation(dx, drag.origin.x);
        dy = snapTranslation(dy, drag.origin.y);
      }
      if (dx === drag.applied.x && dy === drag.applied.y) {
        return;
      }
      const { originals } = drag;
      drag = { ...drag, applied: { x: dx, y: dy } };
      const offsets = new Map<string, Point>();
      for (const [id, position] of originals) {
        offsets.set(id, { x: position.x + dx, y: position.y + dy });
      }
      current = offsetShapes(current, offsets);
      publish(listeners);
    },
    pointerUp: () => {
      if (drag === null) {
        return;
      }
      if (drag.kind !== 'marquee') {
        drag = null;
        publishGesture();
        return;
      }
      const covered = shapesInBox(current.shapes, drag.box).map(
        (shape) => shape.id
      );
      const next = drag.additive ? [...drag.base, ...covered] : covered;
      drag = null;
      commitSelection(next);
      publishGesture();
    },
    setBoard: (next) => {
      current = next;
      commitSelection(selection);
      publish(listeners);
    },
    setCamera: (camera) => {
      setView({ ...view, camera });
    },
    setSelection: (ids) => {
      commitSelection(ids);
    },
    setStyle: (next) => {
      style = next;
    },
    setText: (id, text) => {
      const next = setShapeText(current, id, text);
      if (next === current) {
        return;
      }
      current = next;
      publish(listeners);
    },
    setTextStyle: (id, textStyle) => {
      const next = setShapeTextStyle(current, id, textStyle);
      if (next === current) {
        return;
      }
      current = next;
      publish(listeners);
    },
    setTool: (tool) => {
      setView({ ...view, tool });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeGesture: (listener) => {
      gestureListeners.add(listener);
      return () => {
        gestureListeners.delete(listener);
      };
    },
    subscribeSelection: (listener) => {
      selectionListeners.add(listener);
      return () => {
        selectionListeners.delete(listener);
      };
    },
    subscribeView: (listener) => {
      viewListeners.add(listener);
      return () => {
        viewListeners.delete(listener);
      };
    },
  };
};
