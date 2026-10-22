import { type Board, type GroupShape, nextId, type Shape } from '@kiyora/model';
import { isContainer } from './containment';
import { type Selection, selectedRoots } from './selection';

/**
 * Groups: several shapes made into one thing that moves as a whole, and the
 * inverse, so a group can be taken apart without moving anything.
 *
 * A group owns no geometry. The `x`, `y`, `w` and `h` the schema requires are a
 * stand-in no operation reads or writes; its box is derived from its members by
 * `shapeBounds`, so grouping, moving and ungrouping never have to repair it.
 */

/** The parent every root shares, when all of them sit in one container. */
const sharedParent = (board: Board, roots: readonly Shape[]): string | null => {
  const [first] = roots;
  if (first === undefined) {
    return null;
  }
  const shared = roots.every((shape) => shape.parentId === first.parentId)
    ? first.parentId
    : null;
  if (shared === null) {
    return null;
  }
  const parent = board.shapes.find((shape) => shape.id === shared);

  return parent !== undefined && isContainer(parent) ? shared : null;
};

/** A board with one new group, and the id the group wears. */
export type Grouping = {
  board: Board;
  groupId: string;
};

/**
 * Brings the selection's roots together in one new group. A root keeps its own
 * members, so grouping a frame or a group moves the whole thing as one rather
 * than flattening it. The group lands where its first member was, so paint
 * order cannot put a member before the group that holds it, and it joins the
 * container its members shared. Fewer than two roots is not a group.
 */
export const groupSelection = (
  board: Board,
  selection: Selection
): Grouping | null => {
  const roots = selectedRoots(board, selection);
  const [first] = roots;
  if (roots.length < 2 || first === undefined) {
    return null;
  }

  const groupId = nextId('group', new Set(board.shapes.map((one) => one.id)));
  const group: GroupShape = {
    h: 0,
    id: groupId,
    kind: 'group',
    locked: false,
    opacity: 1,
    parentId: sharedParent(board, roots),
    rotation: 0,
    style: first.style,
    w: 0,
    x: 0,
    y: 0,
  };
  const rootIds = new Set(roots.map((shape) => shape.id));
  const shapes: Shape[] = [];

  for (const shape of board.shapes) {
    if (shape.id === first.id) {
      shapes.push(group);
    }
    shapes.push(
      rootIds.has(shape.id) ? { ...shape, parentId: groupId } : shape
    );
  }

  return { board: { ...board, shapes }, groupId };
};

/** The board without one group, its direct members released to where it stood. */
const ungroupOne = (board: Board, groupId: string): Board => {
  const group = board.shapes.find((shape) => shape.id === groupId);
  if (group === undefined || group.kind !== 'group') {
    return board;
  }

  return {
    ...board,
    shapes: board.shapes
      .filter((shape) => shape.id !== groupId)
      .map((shape) =>
        shape.parentId === groupId
          ? { ...shape, parentId: group.parentId }
          : shape
      ),
  };
};

/** A board with groups taken apart, and the members that came loose. */
export type Ungrouping = {
  board: Board;
  ids: string[];
};

/**
 * Takes every selected group apart, one level each, leaving its members exactly
 * where they were. A member of a group that was itself selected is released by
 * the second pass, so ungrouping a nested pair gives back the leaves. Nothing
 * is moved, and no member loses its own members.
 */
export const ungroupSelection = (
  board: Board,
  selection: Selection
): Ungrouping | null => {
  const groups = board.shapes.filter(
    (shape) => shape.kind === 'group' && selection.includes(shape.id)
  );
  if (groups.length === 0) {
    return null;
  }

  let next = board;
  const released = new Set<string>();
  for (const group of groups) {
    for (const shape of next.shapes) {
      if (shape.parentId === group.id) {
        released.add(shape.id);
      }
    }
    next = ungroupOne(next, group.id);
  }

  return {
    board: next,
    ids: next.shapes
      .filter((shape) => released.has(shape.id))
      .map((shape) => shape.id),
  };
};
