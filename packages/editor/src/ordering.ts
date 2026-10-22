import type { Board, Shape } from '@kiyora/model';
import { type Selection, sameIds, selectedRoots } from './selection';

/**
 * Where a selection moves in paint order: to the front or the back of its
 * siblings, or one place either way.
 */
export type OrderMove = 'front' | 'back' | 'forward' | 'backward';

/**
 * The parent each shape paints under, read the way the paint walker reads it: a
 * `parentId` that names a shape earlier in the array nests the member, and one
 * that names nothing before it leaves the shape at the top level. This is a
 * paint-order question, not the authored chain `ancestorsOf` walks: a parent
 * that sits later in the array names nothing yet, so it nests nothing.
 */
const parentsOf = (board: Board): Map<string, string | null> => {
  const parents = new Map<string, string | null>();
  const held = new Set<string>();

  for (const shape of board.shapes) {
    const parent = shape.parentId;
    parents.set(shape.id, parent !== null && held.has(parent) ? parent : null);
    held.add(shape.id);
  }

  return parents;
};

/**
 * One sibling list in the order `move` asks for. The moving shapes keep their
 * own order, and a step moves the whole block one place rather than tearing it
 * around the shape it passes.
 */
const movedSiblings = (
  siblings: readonly Shape[],
  moving: ReadonlySet<string>,
  move: OrderMove
): Shape[] => {
  const selected = siblings.filter((shape) => moving.has(shape.id));
  const rest = siblings.filter((shape) => !moving.has(shape.id));

  if (move === 'front') {
    return [...rest, ...selected];
  }
  if (move === 'back') {
    return [...selected, ...rest];
  }

  const next = [...siblings];
  if (move === 'forward') {
    for (let index = next.length - 2; index >= 0; index -= 1) {
      const shape = next[index];
      const above = next[index + 1];
      if (
        shape !== undefined &&
        above !== undefined &&
        moving.has(shape.id) &&
        !moving.has(above.id)
      ) {
        next[index] = above;
        next[index + 1] = shape;
      }
    }
    return next;
  }

  for (let index = 1; index < next.length; index += 1) {
    const shape = next[index];
    const below = next[index - 1];
    if (
      shape !== undefined &&
      below !== undefined &&
      moving.has(shape.id) &&
      !moving.has(below.id)
    ) {
      next[index] = below;
      next[index - 1] = shape;
    }
  }

  return next;
};

/**
 * Reorders the selection in paint order. Every moving shape stays in its own
 * sibling list, so a frame's member moves inside its frame and a group moves as
 * one shape with its members inside it. The selected roots — the selected
 * shapes that have no selected ancestor — are the ones that move; a member of a
 * selected group travels with the group. Returns `null` when the order is
 * already what `move` asks for, so a no-op never lands in history.
 */
export const reorderedBoard = (
  board: Board,
  selection: Selection,
  move: OrderMove
): Board | null => {
  const roots = selectedRoots(board, selection);
  if (roots.length === 0) {
    return null;
  }

  const parents = parentsOf(board);
  const moving = new Map<string | null, Set<string>>();
  for (const root of roots) {
    const parent = parents.get(root.id) ?? null;
    const ids = moving.get(parent) ?? new Set<string>();
    ids.add(root.id);
    moving.set(parent, ids);
  }

  const lists = new Map<string | null, Shape[]>();
  for (const shape of board.shapes) {
    const parent = parents.get(shape.id) ?? null;
    const siblings = lists.get(parent) ?? [];
    siblings.push(shape);
    lists.set(parent, siblings);
  }

  let changed = false;
  for (const [parent, ids] of moving) {
    const siblings = lists.get(parent) ?? [];
    const next = movedSiblings(siblings, ids, move);
    if (
      !sameIds(
        next.map((shape) => shape.id),
        siblings.map((shape) => shape.id)
      )
    ) {
      changed = true;
      lists.set(parent, next);
    }
  }
  if (!changed) {
    return null;
  }

  const shapes: Shape[] = [];
  const seen = new Set<string>();
  const visit = (parent: string | null): void => {
    for (const shape of lists.get(parent) ?? []) {
      if (seen.has(shape.id)) {
        continue;
      }
      seen.add(shape.id);
      shapes.push(shape);
      visit(shape.id);
    }
  };
  visit(null);
  for (const shape of board.shapes) {
    if (!seen.has(shape.id)) {
      seen.add(shape.id);
      shapes.push(shape);
    }
  }

  return { ...board, shapes };
};
