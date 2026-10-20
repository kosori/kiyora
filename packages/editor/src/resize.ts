import type { Board } from '@kiyora/model';
import type { Point } from './camera';
import { resizeModifiers } from './geometry/handles';
import type { GestureModifiers } from './modifiers';
import { replaceShapes } from './shape-edit';
import type { ResizeDrag } from './state';
import { resizeRefusal, resizeSelection } from './transform';

/** What one pointer move did to an open resize: the board, and the drag to keep. */
export type ResizeMove = {
  board: Board;
  drag: ResizeDrag;
};

/**
 * One pointer move of an open resize. A refused drag leaves the board exactly
 * where it was and returns the drag carrying the reason, so the store has only
 * to publish it; an exact drag clears a stale reason and replaces the boxes.
 */
export const moveResize = (
  board: Board,
  drag: ResizeDrag,
  point: Point,
  modifiers: GestureModifiers
): ResizeMove => {
  const resolved = resizeModifiers(modifiers);
  const shapes = [...drag.originals.values()];
  const refusal = resizeRefusal(
    shapes,
    drag.bounds,
    drag.handle,
    point,
    resolved
  );

  if (refusal !== null) {
    return {
      board,
      drag: drag.refusal === refusal ? drag : { ...drag, refusal },
    };
  }

  const next = replaceShapes(
    board,
    resizeSelection(shapes, drag.bounds, drag.handle, point, resolved)
  );
  const cleared =
    drag.refusal === undefined ? drag : { ...drag, refusal: undefined };

  return { board: next, drag: cleared };
};
