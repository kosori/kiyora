import type {
  Board,
  Bounds,
  FrameShape,
  GroupShape,
  Shape,
} from '@kiyora/model';

/** A shape that holds members: a frame or a group. */
export type ContainerShape = FrameShape | GroupShape;

/** Whether `shape` is a frame: a shape that holds others and can clip them. */
export const isFrame = (shape: Shape): shape is FrameShape =>
  shape.kind === 'frame';

/** Whether `shape` is a group: a shape that holds others so they move as one. */
export const isGroup = (shape: Shape): shape is GroupShape =>
  shape.kind === 'group';

/** Whether `shape` holds members, whether a frame or a group. */
export const isContainer = (shape: Shape): shape is ContainerShape =>
  isFrame(shape) || isGroup(shape);

/** The container `parentId` names, or `null` when it names nothing that holds members. */
export const parentContainer = (
  board: Board,
  parentId: string | null
): ContainerShape | null => {
  if (parentId === null) {
    return null;
  }
  const shape = board.shapes.find((one) => one.id === parentId);

  return shape !== undefined && isContainer(shape) ? shape : null;
};

/**
 * The outermost group `shapeId` belongs to, itself included, or `null` when it
 * belongs to none. A click on any member picks the group that holds it, so a
 * group reads as one thing until it is taken apart.
 */
export const outermostGroup = (
  board: Board,
  shapeId: string
): string | null => {
  const byId = new Map(board.shapes.map((shape) => [shape.id, shape]));
  const seen = new Set<string>();
  let shape = byId.get(shapeId);
  let group = shape !== undefined && isGroup(shape) ? shape.id : null;

  while (shape !== undefined && shape.parentId !== null) {
    if (seen.has(shape.parentId)) {
      break;
    }
    seen.add(shape.parentId);
    const parent = byId.get(shape.parentId);
    if (parent === undefined) {
      break;
    }
    if (isGroup(parent)) {
      group = parent.id;
    }
    shape = parent;
  }

  return group;
};

/**
 * Every frame on the board, in paint order. A deck is an order over this list,
 * so a frame stays a thing a later ticket can enumerate and reorder.
 */
export const frameIds = (board: Board): string[] =>
  board.shapes.filter(isFrame).map((shape) => shape.id);

/** The ids of a container's direct members, in paint order. */
export const memberIds = (board: Board, containerId: string): string[] =>
  board.shapes
    .filter((shape) => shape.parentId === containerId)
    .map((shape) => shape.id);

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
 * and ordering are the same operation, so the members of a frame or a group can
 * never drift away from it.
 *
 * A frame's authored box is never read and never rewritten: membership moves
 * the member, not the container. A `parentId` that names no container on the
 * board, or a shape the board does not hold, leaves the board as it was.
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
  const parent = parentContainer(board, parentId);
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
