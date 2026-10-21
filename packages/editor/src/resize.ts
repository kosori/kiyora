import type { Board } from '@kiyora/model';
import type { Point } from './camera';
import {
  type Guide,
  guideAcross,
  nearestLine,
  sameGuides,
} from './geometry/guides';
import {
  handleSigns,
  type ResizeModifiers,
  resizeBounds,
  resizeModifiers,
} from './geometry/handles';
import { snapValue } from './geometry/snap';
import type { GestureModifiers } from './modifiers';
import { replaceShapes } from './shape-edit';
import type { ResizeDrag } from './state';
import { resizeRefusal, resizeSelection } from './transform';

/** What one pointer move did to an open resize: the board, and the drag to keep. */
export type ResizeMove = {
  board: Board;
  drag: ResizeDrag;
};

/** What the guides did to a resize: where the pointer now reads, and the guides to draw. */
type EdgeSnap = {
  guides: Guide[];
  pointer: Point;
};

/**
 * The pointer a resize should read, so the edge the handle drags lands on a
 * guide, and the grid snaps that same edge when no guide is close. A turned
 * shape is sized along its own axes, where a world-axis guide has no one edge to
 * land on, and a kept ratio overrules the edge, so both keep the pointer snap
 * they had. `null` means nothing here applies.
 */
const edgeSnap = (
  drag: ResizeDrag,
  point: Point,
  modifiers: ResizeModifiers
): EdgeSnap | null => {
  const shapes = [...drag.originals.values()];
  const [only, ...rest] = shapes;
  const turned = only !== undefined && rest.length === 0 && only.rotation !== 0;
  if (!modifiers.snap || turned || modifiers.keepRatio) {
    return null;
  }
  const signs = handleSigns(drag.handle);
  const pointer = { ...point };
  const lineX = signs.x === 0 ? null : nearestLine(drag.lines, 'x', point.x);
  const lineY = signs.y === 0 ? null : nearestLine(drag.lines, 'y', point.y);
  pointer.x = lineX === null ? snapValue(point.x) : lineX.value;
  pointer.y = lineY === null ? snapValue(point.y) : lineY.value;
  const box = resizeBounds(drag.bounds, drag.handle, pointer, {
    ...modifiers,
    snap: false,
  });
  const guides: Guide[] = [];

  if (lineX !== null) {
    guides.push(guideAcross(lineX, box.y, box.y + box.h));
  }
  if (lineY !== null) {
    guides.push(guideAcross(lineY, box.x, box.x + box.w));
  }

  return { guides, pointer };
};

/** The drag to keep, unchanged when neither the refusal nor the guides moved. */
const keptDrag = (
  drag: ResizeDrag,
  refusal: string | null,
  guides: readonly Guide[]
): ResizeDrag => {
  if ((drag.refusal ?? null) === refusal && sameGuides(drag.guides, guides)) {
    return drag;
  }

  return {
    ...drag,
    guides,
    ...(refusal === null ? { refusal: undefined } : { refusal }),
  };
};

/**
 * One pointer move of an open resize. A refused drag leaves the board exactly
 * where it was and returns the drag carrying the reason, so the store has only
 * to publish it; an exact drag clears a stale reason and replaces the boxes.
 * The edge a handle drags reads the alignment guides first and the grid after
 * them, per axis, so one edge can land on another shape while the other keeps
 * the grid.
 */
export const moveResize = (
  board: Board,
  drag: ResizeDrag,
  point: Point,
  modifiers: GestureModifiers
): ResizeMove => {
  const resolved = resizeModifiers(modifiers);
  const shapes = [...drag.originals.values()];
  const snapped = edgeSnap(drag, point, resolved);
  const pointer = snapped?.pointer ?? point;
  const guides = snapped?.guides ?? [];
  const effective = snapped === null ? resolved : { ...resolved, snap: false };
  const refusal = resizeRefusal(
    shapes,
    drag.bounds,
    drag.handle,
    pointer,
    effective
  );

  if (refusal !== null) {
    return { board, drag: keptDrag(drag, refusal, guides) };
  }

  return {
    board: replaceShapes(
      board,
      resizeSelection(shapes, drag.bounds, drag.handle, pointer, effective)
    ),
    drag: keptDrag(drag, null, guides),
  };
};
