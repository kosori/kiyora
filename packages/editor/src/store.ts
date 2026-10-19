import type { Board, Style } from '@kiyora/model';
import type { Point } from './camera';
import { addShape, subtreeIds } from './containment';
import { resizeModifiers } from './geometry/handles';
import { boxBetween, shapeAt, shapesInBox } from './geometry/hit-test';
import { snapTranslation } from './geometry/snap';
import { gestureOf, handleDrag, moveDrag } from './gesture';
import { createTransactions } from './history/transaction';
import { shapeFromPlacement } from './placement';
import { restyledBoard } from './restyle';
import {
  normaliseSelection,
  offsetShapes,
  type Selection,
  sameIds,
  selectedShapes,
} from './selection';
import {
  replaceShapes,
  setShapeText,
  setShapeTextStyle,
  translateShapes,
} from './shape-edit';
import type { Drag, Editor, Gesture, View } from './state';
import { DEFAULT_STYLE, placesShape } from './tools';
import {
  angleAt,
  resizeSelection,
  rotateSelection,
  shortestDelta,
} from './transform';

export type { Drag, Editor, Gesture, View } from './state';

/** An engine over `board`, holding it and publishing each replacement. */
export const createEditor = (board: Board): Editor => {
  let current = board;
  let view: View = { camera: board.camera, tool: 'select' };
  let style: Style = DEFAULT_STYLE;
  let selection: Selection = [];
  let drag: Drag | null = null;
  let cachedDrag: Drag | null = null;
  let cachedGesture: Gesture = { kind: 'idle' };
  const transactions = createTransactions();
  const listeners = new Set<() => void>();
  const viewListeners = new Set<() => void>();
  const selectionListeners = new Set<() => void>();
  const gestureListeners = new Set<() => void>();

  const publish = (set: Set<() => void>): void => {
    for (const listener of set) {
      listener();
    }
  };

  /** Adopts `next` as the board and publishes it, unless it is the same board. */
  const publishChange = (next: Board): void => {
    if (next === current) {
      return;
    }
    current = next;
    publish(listeners);
  };

  const setView = (next: View): void => {
    view = next;
    publish(viewListeners);
  };

  const publishGesture = (): void => {
    publish(gestureListeners);
  };

  /** Drops an open gesture without restoring it, so history can replace the board. */
  const abandonGesture = (): void => {
    if (drag === null) {
      return;
    }
    drag = null;
    publishGesture();
  };

  /** Opens the board `next` replaces, keeping the selection honest and repainting. */
  const restore = (next: Board | null): void => {
    if (next === null) {
      return;
    }
    abandonGesture();
    current = next;
    commitSelection(selection);
    publish(listeners);
  };

  /**
   * The gesture as a value, memoised on the drag it came from: two reads with
   * nothing in between must see the same object, or a snapshot subscription
   * that compares references would loop forever.
   */
  const gestureNow = (): Gesture => {
    if (drag !== cachedDrag) {
      cachedDrag = drag;
      cachedGesture = gestureOf(drag);
    }
    return cachedGesture;
  };

  /** Keeps only ids the board holds, in paint order, and publishes a real change. */
  const commitSelection = (next: Selection): void => {
    const ids = normaliseSelection(current, next);
    if (sameIds(ids, selection)) {
      return;
    }
    transactions.endNudgeRun();
    selection = ids;
    publish(selectionListeners);
  };

  /** Adopts `opened` as the open drag, publishing the gesture it means. */
  const openDrag = (opened: Drag | null): boolean => {
    if (opened === null) {
      return false;
    }
    drag = opened;
    publishGesture();
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
          publishChange(offsetShapes(current, open.originals));
        }
      } else if (open.kind === 'marquee') {
        commitSelection(open.base);
      } else {
        publishChange(replaceShapes(current, open.originals));
      }
      publishGesture();
    },
    endNudgeRun: () => {
      transactions.endNudgeRun();
    },
    getBoard: () => current,
    getGesture: gestureNow,
    getHistory: () => transactions.getState(),
    getSelection: () => selection,
    getStyle: () => style,
    getTool: () => view.tool,
    getView: () => view,
    nudge: (dx, dy) => {
      const ids = subtreeIds(current, selection);
      if (selectedShapes(current, ids).length === 0) {
        return;
      }
      transactions.noteNudge(current);
      publishChange(translateShapes(current, ids, dx, dy));
    },
    placeShape: (placement) => {
      const { tool } = view;
      if (!placesShape(tool)) {
        return null;
      }
      transactions.endNudgeRun();
      const before = current;
      const shape = shapeFromPlacement(tool, placement, style, current.shapes);
      current = addShape(current, shape);
      setView({ ...view, tool: 'select' });
      transactions.commit(before, current);
      publish(listeners);
      return shape;
    },
    pointerDown: (point, additive) => {
      transactions.endNudgeRun();
      if (
        openDrag(
          handleDrag(current, selection, view.tool, view.camera.zoom, point)
        )
      ) {
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
        openDrag(moveDrag(current, selection, point));
      }
    },
    pointerMove: (point, modifiers) => {
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
          resizeModifiers(modifiers)
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
          modifiers
        );
        current = replaceShapes(current, replacements);
        publish(listeners);
        return;
      }
      let dx = point.x - drag.start.x;
      let dy = point.y - drag.start.y;
      if (!modifiers.bypassSnap) {
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
        transactions.commit(before, current);
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
      restore(transactions.redo(current));
    },
    restyle: (change) => {
      transactions.endNudgeRun();
      const before = current;
      const result = restyledBoard(current, selection, change);
      if (result === null) {
        return;
      }
      const { board: nextBoard, style: nextStyle } = result;
      current = nextBoard;
      style = nextStyle;
      transactions.commit(before, current);
      publish(listeners);
    },
    setBoard: (next) => {
      transactions.endNudgeRun();
      current = next;
      commitSelection(selection);
      transactions.clear();
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
    setText: (id, text) => publishChange(setShapeText(current, id, text)),
    setTextStyle: (id, textStyle) =>
      publishChange(setShapeTextStyle(current, id, textStyle)),
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
    subscribeHistory: (listener) => transactions.subscribe(listener),
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
      restore(transactions.undo(current));
    },
  };
};
