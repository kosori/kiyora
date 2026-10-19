import type { Board, Style } from '@kiyora/model';
import type { Point } from './camera';
import { boxBetween, shapeAt, shapesInBox } from './geometry/hit-test';
import { snapTranslation } from './geometry/snap';
import { createHistory } from './history/stack';
import { shapeFromPlacement } from './placement';
import {
  normaliseSelection,
  offsetShapes,
  type Selection,
  selectedShapes,
} from './selection';
import type { Drag, Editor, Gesture, MoveDrag, View } from './state';
import { DEFAULT_STYLE, isFigureTool } from './tools';

export type { Drag, Editor, Gesture, Restyle, View } from './state';

/** An engine over `board`, holding it and publishing each replacement. */
export const createEditor = (board: Board): Editor => {
  let current = board;
  let view: View = { camera: board.camera, tool: 'select' };
  let style: Style = DEFAULT_STYLE;
  let selection: Selection = [];
  let drag: Drag | null = null;
  let cachedDrag: Drag | null = null;
  let cachedGesture: Gesture = { kind: 'idle' };
  const history = createHistory();
  let nudgeRun: { before: Board; key: string } | null = null;
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
   * Records `before` as one history entry, unless the gesture left the board
   * untouched. Committing is the notification: a control reads whether undo is
   * possible from it, so a stale button cannot survive a gesture.
   */
  const commit = (before: Board): void => {
    if (before === current) {
      return;
    }
    history.commit(before);
  };

  /** Records the open run of nudges as one entry, and closes it. */
  const flushNudge = (): void => {
    if (nudgeRun === null) {
      return;
    }
    const run = nudgeRun;
    nudgeRun = null;
    commit(run.before);
  };

  /** Drops an open gesture without restoring it, so history can replace the board. */
  const abandonGesture = (): void => {
    if (drag === null) {
      return;
    }
    drag = null;
    publishGesture();
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
    flushNudge();
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
      before: current,
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
    endNudgeRun: () => {
      flushNudge();
    },
    getBoard: () => current,
    getGesture: gestureNow,
    getHistory: () => history.getState(),
    getSelection: () => selection,
    getStyle: () => style,
    getTool: () => view.tool,
    getView: () => view,
    nudge: (dx, dy) => {
      const shapes = selectedShapes(current, selection);
      if (shapes.length === 0) {
        return;
      }
      const key = selection.join('\u0000');
      if (nudgeRun !== null && nudgeRun.key !== key) {
        flushNudge();
      }
      if (nudgeRun === null) {
        nudgeRun = { before: current, key };
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
      flushNudge();
      const before = current;
      const shape = shapeFromPlacement(tool, placement, style, current.shapes);
      current = { ...current, shapes: [...current.shapes, shape] };
      setView({ ...view, tool: 'select' });
      commit(before);
      publish(listeners);
    },
    pointerDown: (point, additive) => {
      flushNudge();
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
        const { before } = drag;
        drag = null;
        commit(before);
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
    redo: () => {
      flushNudge();
      abandonGesture();
      const next = history.redo(current);
      if (next === null) {
        return;
      }
      current = next;
      commitSelection(selection);
      publish(listeners);
    },
    restyle: (change) => {
      const shapes = selectedShapes(current, selection);
      if (shapes.length === 0) {
        return;
      }
      flushNudge();
      const before = current;
      const selected = new Set(shapes.map((one) => one.id));
      let restyled: Style | null = null;
      current = {
        ...current,
        shapes: current.shapes.map((one) => {
          if (!selected.has(one.id)) {
            return one;
          }
          const next = {
            ...one,
            ...(change.opacity === undefined
              ? {}
              : { opacity: change.opacity }),
            style:
              change.style === undefined
                ? one.style
                : { ...one.style, ...change.style },
          };
          restyled ??= next.style;
          return next;
        }),
      };
      if (restyled !== null) {
        style = restyled;
      }
      commit(before);
      publish(listeners);
    },
    setBoard: (next) => {
      flushNudge();
      current = next;
      commitSelection(selection);
      history.clear();
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
    subscribeHistory: (listener) => history.subscribe(listener),
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
    undo: () => {
      flushNudge();
      abandonGesture();
      const previous = history.undo(current);
      if (previous === null) {
        return;
      }
      current = previous;
      commitSelection(selection);
      publish(listeners);
    },
  };
};
