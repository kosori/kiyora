import type { Board, Bounds, FrameShape, Shape } from '@kiyora/model';

/** Whether `shape` is a frame: a shape that holds others and can clip them. */
export const isFrame = (shape: Shape): shape is FrameShape =>
  shape.kind === 'frame';

/** The frame `parentId` names, or `null` when it names nothing that is one. */
export const parentFrame = (
  board: Board,
  parentId: string | null
): FrameShape | null => {
  if (parentId === null) {
    return null;
  }
  const shape = board.shapes.find((one) => one.id === parentId);

  return shape !== undefined && isFrame(shape) ? shape : null;
};

/**
 * Every frame on the board, in paint order. A deck is an order over this list,
 * so a frame stays a thing a later ticket can enumerate and reorder.
 */
export const frameIds = (board: Board): string[] =>
  board.shapes.filter(isFrame).map((shape) => shape.id);

/** The ids of a frame's direct members, in paint order. */
export const memberIds = (board: Board, frameId: string): string[] =>
  board.shapes
    .filter((shape) => shape.parentId === frameId)
    .map((shape) => shape.id);

/**
 * `ids` and everything held inside them, in paint order. A move carries this
 * whole set, so dragging a frame takes its members along.
 */
export const subtreeIds = (board: Board, ids: readonly string[]): string[] => {
  const wanted = new Set(ids);
  let grew = true;

  while (grew) {
    grew = false;
    for (const shape of board.shapes) {
      if (
        shape.parentId !== null &&
        wanted.has(shape.parentId) &&
        !wanted.has(shape.id)
      ) {
        wanted.add(shape.id);
        grew = true;
      }
    }
  }

  return board.shapes
    .filter((shape) => wanted.has(shape.id))
    .map((shape) => shape.id);
};

/** Whether `box` lies wholly inside `frame`'s authored box. */
const holdsBox = (frame: FrameShape, box: Bounds): boolean =>
  box.x >= frame.x &&
  box.y >= frame.y &&
  box.x + box.w <= frame.x + frame.w &&
  box.y + box.h <= frame.y + frame.h;

/**
 * The frame whose box holds `box`, the topmost one when several do, or `null`
 * when none does. Membership is decided by the box a shape lands in, so drawing
 * inside a frame is enough to join it.
 */
export const frameAround = (board: Board, box: Bounds): FrameShape | null => {
  for (let index = board.shapes.length - 1; index >= 0; index -= 1) {
    const shape = board.shapes[index];
    if (shape !== undefined && isFrame(shape) && holdsBox(shape, box)) {
      return shape;
    }
  }
  return null;
};

/**
 * Records which shape holds `shapeId`, and where it sits among that parent's
 * members, in one edit of the paint-order array plus the pointer. Membership
 * and ordering are the same operation, so the members of a frame can never
 * drift away from it.
 *
 * The frame's authored box is never read and never rewritten: membership moves
 * the member, not the frame. A `parentId` that names no frame on the board, or
 * a shape the board does not hold, leaves the board as it was.
 */
export const setMembership = (
  board: Board,
  shapeId: string,
  parentId: string | null,
  index?: number
): Board => {
  const shape = board.shapes.find((one) => one.id === shapeId);
  if (shape === undefined || (parentId !== null && shapeId === parentId)) {
    return board;
  }
  const parent = parentFrame(board, parentId);
  if (parentId !== null && parent === null) {
    return board;
  }

  const rest = board.shapes.filter((one) => one.id !== shapeId);
  const moved: Shape = { ...shape, parentId };

  let at = rest.length;
  if (parent !== null) {
    const members = memberIds(board, parent.id).filter((id) => id !== shapeId);
    const slots = index === undefined ? members.length : index;
    const clamped = Math.max(0, Math.min(slots, members.length));
    const anchor = members[clamped - 1];
    const anchorAt =
      anchor === undefined
        ? rest.findIndex((one) => one.id === parent.id)
        : rest.findIndex((one) => one.id === anchor);
    at = Math.max(0, anchorAt) + 1;
  }

  return {
    ...board,
    shapes: [...rest.slice(0, at), moved, ...rest.slice(at)],
  };
};

/**
 * Adds `shape` to the board: into the frame its box lands in, so a shape drawn
 * inside a frame joins it, or on top of the board when it lands in no frame.
 * The frame's authored box is not consulted beyond deciding membership.
 */
export const addShape = (board: Board, shape: Shape): Board => {
  const withShape: Board = { ...board, shapes: [...board.shapes, shape] };
  const parent = frameAround(board, shape);

  return parent === null
    ? withShape
    : setMembership(withShape, shape.id, parent.id);
};
