import type { Board, Shape } from '../board/schema';
import { type Bounds, shapeBounds } from './figures';

/** Whether two boxes share any area, an edge touching included. */
const meet = (a: Bounds, b: Bounds): boolean =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

/**
 * The shapes a view can show, in paint order: every shape whose painted box
 * meets the view, plus any ancestor that carries one, and nothing else. A
 * connector is judged by the box its ends resolve to, so a line crossing the
 * view stays even when both shapes it joins are off screen; a frame is kept
 * when a member reaches the view, so the member never loses its nesting.
 *
 * A shape outside the view is not painted at all, which is what keeps a
 * thousand-shape board's DOM in proportion to the screen rather than the board.
 */
export const shapesInView = (board: Board, view: Bounds): Shape[] => {
  const byId = new Map(board.shapes.map((shape) => [shape.id, shape]));
  const shown = new Set<string>();

  for (const shape of board.shapes) {
    if (!meet(shapeBounds(shape, board.shapes), view)) {
      continue;
    }
    let node: Shape | undefined = shape;
    while (node !== undefined && !shown.has(node.id)) {
      shown.add(node.id);
      node = node.parentId === null ? undefined : byId.get(node.parentId);
    }
  }

  return board.shapes.filter((shape) => shown.has(shape.id));
};
