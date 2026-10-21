import {
  type Board,
  type Bounds,
  boundsOfShapes,
  type Shape,
  subtreeIds,
} from '@kiyora/model';
import { movedShape } from './shape-edit';

/** The ids of the shapes currently selected, in paint order. Display state, never in the document. */
export type Selection = readonly string[];

/** The selected shapes, in paint order. */
export const selectedShapes = (board: Board, selection: Selection): Shape[] =>
  board.shapes.filter((shape) => selection.includes(shape.id));

/** Whether any selected shape is locked, so a lock control offers the way back. */
export const selectedLocked = (board: Board, selection: Selection): boolean =>
  selectedShapes(board, selection).some((shape) => shape.locked);

/**
 * The ids `selection` names, kept to the shapes the board actually holds and
 * ordered the way the board paints them, so the selection has one reading
 * whichever way it was built.
 */
export const normaliseSelection = (
  board: Board,
  selection: Selection
): string[] =>
  board.shapes
    .filter((shape) => selection.includes(shape.id))
    .map((shape) => shape.id);

/** The box that holds the whole selection, or `null` when nothing is selected. */
export const selectionBounds = (
  board: Board,
  selection: Selection
): Bounds | null =>
  boundsOfShapes(selectedShapes(board, selection), board.shapes);

/**
 * The selected shapes that have no selected ancestor, in paint order. Moving a
 * root moves what it holds, so a selection that names both a group and its
 * member must not move the member twice.
 */
export const selectedRoots = (board: Board, selection: Selection): Shape[] => {
  const selected = new Set(selection);
  const parents = new Map(
    board.shapes.map((shape) => [shape.id, shape.parentId])
  );
  const hasSelectedAncestor = (shape: Shape): boolean => {
    const seen = new Set<string>([shape.id]);
    let parent = shape.parentId;
    while (parent !== null) {
      if (selected.has(parent) || seen.has(parent)) {
        return selected.has(parent);
      }
      seen.add(parent);
      parent = parents.get(parent) ?? null;
    }
    return false;
  };

  return board.shapes.filter(
    (shape) => selected.has(shape.id) && !hasSelectedAncestor(shape)
  );
};

/**
 * The shapes a resize or a rotation must move: the selection, plus everything
 * held inside any selected group. A selected frame stays alone, because its box
 * is authored and resizing it never moves what it holds; a selected group has
 * no box of its own, so its members are the shapes that scale and turn.
 */
export const transformTargets = (
  board: Board,
  selection: Selection
): Shape[] => {
  const ids = new Set(selection);
  for (const shape of selectedShapes(board, selection)) {
    if (shape.kind !== 'group') {
      continue;
    }
    for (const id of subtreeIds(board, [shape.id])) {
      ids.add(id);
    }
  }

  return selectedShapes(board, [...ids]);
};

/** An absolute position per shape id. */
export type Offsets = ReadonlyMap<string, { x: number; y: number }>;

/** Whether both id lists say the same thing, in the same order. */
export const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/** Moves the named shapes to their offsets, leaving every other shape alone. */
export const offsetShapes = (board: Board, offsets: Offsets): Board => {
  if (offsets.size === 0) {
    return board;
  }
  return {
    ...board,
    shapes: board.shapes.map((shape) => {
      const offset = offsets.get(shape.id);
      return offset === undefined
        ? shape
        : movedShape(shape, offset.x - shape.x, offset.y - shape.y);
    }),
  };
};
