import { type Board, type Bounds, subtreeIds } from '@kiyora/model';
import type { Point } from './camera';
import { type HandleKind, handleAt } from './geometry/handles';
import { type Selection, selectedShapes, selectionBounds } from './selection';
import { snapshotShapes } from './shape-edit';
import type { Drag, Gesture, MoveDrag, ResizeDrag, RotateDrag } from './state';
import type { Tool } from './tools';
import { angleAt } from './transform';

/**
 * Opening a pointer gesture, and how it reads as a value. Everything here is a
 * function of the board, the selection and the pointer, so a gesture is proven
 * without a store: the store keeps the open drag and publishes it.
 */

/**
 * The gesture as a value. The store memoises it on the drag it came from, so two
 * reads with nothing in between see the same object.
 */
export const gestureOf = (drag: Drag | null): Gesture =>
  drag === null
    ? { kind: 'idle' }
    : drag.kind === 'move'
      ? { kind: 'move' }
      : drag.kind === 'marquee'
        ? { box: drag.box, kind: 'marquee' }
        : drag.kind === 'resize'
          ? {
              handle: drag.handle,
              kind: 'resize',
              ...(drag.refusal === undefined ? {} : { refusal: drag.refusal }),
            }
          : { kind: 'rotate' };

/** The move drag `point` opens over the selection's subtree, or `null` when it holds nothing. */
export const moveDrag = (
  board: Board,
  selection: Selection,
  point: Point
): MoveDrag | null => {
  const shapes = selectedShapes(board, subtreeIds(board, selection)).filter(
    (shape) => !shape.locked
  );
  if (shapes.length === 0) {
    return null;
  }
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  for (const shape of shapes) {
    left = Math.min(left, shape.x);
    top = Math.min(top, shape.y);
  }
  return {
    applied: { x: 0, y: 0 },
    before: board,
    kind: 'move',
    origin: { x: left, y: top },
    originals: new Map(
      shapes.map((shape) => [shape.id, { x: shape.x, y: shape.y }])
    ),
    start: point,
  };
};

/** The resize on `handle` of the selection's box, keeping the box it started on. */
const resizeDrag = (
  board: Board,
  selection: Selection,
  bounds: Bounds,
  handle: HandleKind
): ResizeDrag => ({
  before: board,
  bounds,
  handle,
  kind: 'resize',
  originals: snapshotShapes(selectedShapes(board, selection)),
});

/** The rotate about the selection centre, starting from the pointer's angle. */
const rotateDrag = (
  board: Board,
  selection: Selection,
  bounds: Bounds,
  point: Point
): RotateDrag => {
  const centre = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  return {
    before: board,
    centre,
    kind: 'rotate',
    originals: snapshotShapes(selectedShapes(board, selection)),
    start: angleAt(centre, point),
  };
};

/** The resize or rotate `point` opens on a handle of the selection, or `null`. */
export const handleDrag = (
  board: Board,
  selection: Selection,
  tool: Tool,
  zoom: number,
  point: Point
): Drag | null => {
  if (tool !== 'select' || selection.length === 0) {
    return null;
  }
  if (
    selectedShapes(board, selection).some((shape) => shape.kind === 'connector')
  ) {
    return null;
  }
  const bounds = selectionBounds(board, selection);
  if (bounds === null) {
    return null;
  }
  const handle = handleAt(bounds, point, zoom);
  if (handle === null) {
    return null;
  }
  return handle === 'rotate'
    ? rotateDrag(board, selection, bounds, point)
    : resizeDrag(board, selection, bounds, handle);
};
