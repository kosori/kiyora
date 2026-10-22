import type { Point } from './camera';
import { outermostGroup } from './containment';
import { type Guide, sameGuides, snapBox } from './geometry/guides';
import { boxBetween, shapeAt, shapesInBox } from './geometry/hit-test';
import { snapTranslation } from './geometry/snap';
import { gestureOf, handleDrag, moveDrag } from './gesture';
import { beginInk, extendInk, finishInk } from './ink';
import type { GestureModifiers } from './modifiers';
import { moveResize } from './resize';
import { offsetShapes } from './selection';
import { replaceShapes } from './shape-edit';
import { markSourceStale } from './source-state';
import type { Drag, Gesture } from './state';
import type { StoreCore } from './store-core';
import { subscriptionOf } from './subscription';
import { isInkTool } from './tools';
import { angleAt, rotateSelection, shortestDelta } from './transform';

/** The pointer gestures the editor exposes, and the value the marquee is drawn from. */
export type Gestures = {
  /** What the pointer is doing now: idle, moving, or sweeping a marquee. */
  getGesture: () => Gesture;
  /** Subscribes to gesture changes, so a marquee can be drawn. Returns the unsubscribe. */
  subscribeGesture: (listener: () => void) => () => void;
  /**
   * The pointer going down on the board. On a handle of the current selection it
   * opens a resize or a rotate; on a shape it selects it — adding to the
   * selection when `additive` — and opens a move; on empty canvas it clears the
   * selection unless `additive`, and opens a marquee. An ink tool opens a
   * stroke instead, and `pressure` is what the device reported for it.
   */
  pointerDown: (
    point: Point,
    additive: boolean,
    includeLocked?: boolean,
    pressure?: number
  ) => void;
  /**
   * The pointer moving with a gesture open. A marquee redraws its box; a move,
   * a resize and a rotate each read the one `modifiers` value; an ink stroke
   * appends the point with the pressure the device reported.
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
  /** Drops an open gesture without restoring it, so history can replace the board. */
  abandon: () => void;
};

/**
 * The gestures over `core`. A drag is a value that lives only while the pointer
 * is down; the board moves without a history entry until the pointer lifts, so
 * thirty pointer moves are one undo, not thirty. Every handler reads and writes
 * the board through the core's one funnel, and nothing here touches the DOM.
 */
export const createGestures = (core: StoreCore): Gestures => {
  let drag: Drag | null = null;
  let cachedDrag: Drag | null = null;
  let cachedGesture: Gesture = { kind: 'idle' };
  const gestureListeners = new Set<() => void>();

  const publishGesture = (): void => {
    for (const listener of gestureListeners) {
      listener();
    }
  };

  /** Drops an open gesture without restoring it, so history can replace the board. */
  const abandon = (): void => {
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
      cachedGesture = gestureOf(drag);
    }
    return cachedGesture;
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
    abandon,
    cancelGesture: () => {
      if (drag === null) {
        return;
      }
      const open = drag;
      drag = null;
      if (open.kind === 'move') {
        if (open.applied.x !== 0 || open.applied.y !== 0) {
          core.publish(offsetShapes(core.board(), open.originals));
        }
      } else if (open.kind === 'marquee') {
        core.select(open.base);
      } else if (open.kind === 'ink') {
        core.publish(open.before);
      } else {
        core.publish(replaceShapes(core.board(), open.originals));
      }
      publishGesture();
    },
    getGesture: gestureNow,
    pointerDown: (point, additive, includeLocked, pressure) => {
      core.transactions.endNudgeRun();
      const board = core.board();
      const selection = core.selection();
      const { camera, tool } = core.view();
      if (isInkTool(tool)) {
        const { board: placed, drag: opened } = beginInk(
          board,
          tool === 'highlighter' ? 'highlighter' : 'pen',
          core.style(),
          point,
          pressure,
          camera.zoom
        );
        drag = opened;
        core.publish(placed);
        publishGesture();
        return;
      }
      if (openDrag(handleDrag(board, selection, tool, camera.zoom, point))) {
        return;
      }
      const hit = shapeAt(board.shapes, point, includeLocked);
      if (hit === null) {
        drag = {
          additive,
          base: selection,
          box: boxBetween(point, point),
          from: point,
          kind: 'marquee',
        };
        if (!additive) {
          core.select([]);
        }
        publishGesture();
        return;
      }
      const target = outermostGroup(board, hit.id) ?? hit.id;
      if (additive) {
        core.select(
          core.selection().includes(target)
            ? core.selection().filter((id) => id !== target)
            : [...core.selection(), target]
        );
      } else if (!core.selection().includes(target)) {
        core.select([target]);
      }
      if (core.selection().includes(target)) {
        openDrag(moveDrag(board, core.selection(), point));
      }
    },
    pointerMove: (point, modifiers, pressure) => {
      if (drag === null) {
        return;
      }
      if (drag.kind === 'ink') {
        const { board: nextBoard, drag: nextDrag } = extendInk(
          drag,
          point,
          pressure
        );
        drag = nextDrag;
        core.publish(nextBoard);
        publishGesture();
        return;
      }
      if (drag.kind === 'marquee') {
        drag = { ...drag, box: boxBetween(drag.from, point) };
        publishGesture();
        return;
      }
      const board = core.board();
      if (drag.kind === 'resize') {
        const { board: nextBoard, drag: nextDrag } = moveResize(
          board,
          drag,
          point,
          modifiers
        );
        if (nextDrag !== drag) {
          drag = nextDrag;
          publishGesture();
        }
        if (nextBoard !== board) {
          core.publish(nextBoard);
        }
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
        core.publish(replaceShapes(board, replacements));
        return;
      }
      let dx = point.x - drag.start.x;
      let dy = point.y - drag.start.y;
      let guides: readonly Guide[] = [];
      if (!modifiers.bypassSnap) {
        const snap = snapBox(drag.box, { x: dx, y: dy }, drag.lines);
        guides = [snap.x, snap.y].filter(
          (guide): guide is Guide => guide !== null
        );
        dx = snap.x === null ? snapTranslation(dx, drag.box.x) : snap.dx;
        dy = snap.y === null ? snapTranslation(dy, drag.box.y) : snap.dy;
      }
      const moved = dx !== drag.applied.x || dy !== drag.applied.y;
      if (!moved && sameGuides(drag.guides, guides)) {
        return;
      }
      const { originals } = drag;
      drag = { ...drag, applied: { x: dx, y: dy }, guides };
      publishGesture();
      if (!moved) {
        return;
      }
      const offsets = new Map<string, Point>();
      for (const [id, position] of originals) {
        offsets.set(id, { x: position.x + dx, y: position.y + dy });
      }
      core.publish(offsetShapes(board, offsets));
    },
    pointerUp: () => {
      if (drag === null) {
        return;
      }
      if (drag.kind === 'ink') {
        const { before } = drag;
        const next = finishInk(drag);
        drag = null;
        core.publish(next);
        core.transactions.commit(before, next);
        publishGesture();
        return;
      }
      if (drag.kind !== 'marquee') {
        const { before, originals } = drag;
        drag = null;
        const next = markSourceStale(before, core.board(), originals.keys());
        core.publish(next);
        core.transactions.commit(before, core.board());
        publishGesture();
        return;
      }
      const covered = shapesInBox(core.board().shapes, drag.box).map(
        (shape) => shape.id
      );
      const next = drag.additive ? [...drag.base, ...covered] : covered;
      drag = null;
      core.select(next);
      publishGesture();
    },
    subscribeGesture: subscriptionOf(gestureListeners),
  };
};
