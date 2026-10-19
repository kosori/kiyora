import type { Board, Bounds, Shape, Style } from '@kiyora/model';
import type { Point } from './camera';
import { type HandleKind, handleAt } from './geometry/handles';
import { boxBetween, shapeAt, shapesInBox } from './geometry/hit-test';
import { snapTranslation } from './geometry/snap';
import { shapeFromPlacement } from './placement';
import {
  normaliseSelection,
  offsetShapes,
  type Selection,
  selectedShapes,
  selectionBounds,
} from './selection';
import type { Drag, Editor, Gesture, MoveDrag, View } from './state';
import { DEFAULT_STYLE, isFigureTool } from './tools';
import { angleAt, resizeSelection, rotateSelection } from './transform';

export type { Drag, Editor, Gesture, View } from './state';

/** The board with the named shapes swapped for their replacements. */
const replaceShapes = (
  board: Board,
  replacements: ReadonlyMap<string, Shape>
): Board => {
  if (replacements.size === 0) {
    return board;
  }
  return {
    ...board,
    shapes: board.shapes.map((shape) => replacements.get(shape.id) ?? shape),
  };
};

/** The before-picture of a set of shapes, keyed by id. */
const snapshot = (shapes: readonly Shape[]): ReadonlyMap<string, Shape> =>
  new Map(shapes.map((shape) => [shape.id, shape]));

/** The signed turn between two angles, always the short way round. */
const shortestDelta = (delta: number): number => {
  if (delta > 180) {
    return delta - 360;
  }
  if (delta < -180) {
    return delta + 360;
  }
  return delta;
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
            : drag.kind === 'marquee'
              ? { box: drag.box, kind: 'marquee' }
              : drag.kind === 'resize'
                ? { handle: drag.handle, kind: 'resize' }
                : { kind: 'rotate' };
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

  /** Puts every shape back where a resize or a rotate found it. */
  const restoreShapes = (originals: ReadonlyMap<string, Shape>): void => {
    current = replaceShapes(current, originals);
    publish(listeners);
  };

  /** Opens a resize on `handle`, which keeps the box it started on. */
  const beginResize = (bounds: Bounds, handle: HandleKind): void => {
    drag = {
      bounds,
      handle,
      kind: 'resize',
      originals: snapshot(selectedShapes(current, selection)),
    };
    publishGesture();
  };

  /** Opens a rotate about the selection centre, starting from the pointer's angle. */
  const beginRotate = (bounds: Bounds, point: Point): void => {
    const centre = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    drag = {
      centre,
      kind: 'rotate',
      originals: snapshot(selectedShapes(current, selection)),
      start: angleAt(centre, point),
    };
    publishGesture();
  };

  /** Opens a resize or a rotate when the pointer lands on a handle of the selection. */
  const beginHandle = (point: Point): boolean => {
    if (view.tool !== 'select' || selection.length === 0) {
      return false;
    }
    const bounds = selectionBounds(current, selection);
    if (bounds === null) {
      return false;
    }
    const handle = handleAt(bounds, point, view.camera.zoom);
    if (handle === null) {
      return false;
    }
    if (handle === 'rotate') {
      beginRotate(bounds, point);
    } else {
      beginResize(bounds, handle);
    }
    return true;
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
      } else if (open.kind === 'marquee') {
        commitSelection(open.base);
      } else {
        restoreShapes(open.originals);
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
      if (!isFigureTool(tool)) {
        return;
      }
      const shape = shapeFromPlacement(tool, placement, style, current.shapes);
      current = { ...current, shapes: [...current.shapes, shape] };
      setView({ ...view, tool: 'select' });
      publish(listeners);
    },
    pointerDown: (point, additive) => {
      if (beginHandle(point)) {
        return;
      }
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
    pointerMove: (point, bypassSnap, shift) => {
      if (drag === null) {
        return;
      }
      if (drag.kind === 'marquee') {
        drag = { ...drag, box: boxBetween(drag.from, point) };
        publishGesture();
        return;
      }
      if (drag.kind === 'resize') {
        const replacements = resizeSelection(
          [...drag.originals.values()],
          drag.bounds,
          drag.handle,
          point,
          { fromCentre: bypassSnap, keepRatio: shift ?? false, snap: true }
        );
        current = replaceShapes(current, replacements);
        publish(listeners);
        return;
      }
      if (drag.kind === 'rotate') {
        const delta = shortestDelta(angleAt(drag.centre, point) - drag.start);
        const replacements = rotateSelection(
          [...drag.originals.values()],
          drag.centre,
          delta,
          shift ?? false
        );
        current = replaceShapes(current, replacements);
        publish(listeners);
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
