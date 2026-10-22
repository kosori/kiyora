import {
  type Board,
  type Bounds,
  boundsOfShapes,
  type Shape,
  shapeBounds,
  subtreeIds,
} from '@kiyora/model';
import { type Selection, selectedRoots } from './selection';
import { movedShape, replaceShapes } from './shape-edit';

/**
 * Arrangement: aligning a selection to an edge or a centre of its own box, and
 * spacing its shapes evenly. The geometry lives here, away from the Inspector
 * and the keymap, so it is proven in Node and both surfaces run the same code.
 *
 * A Connector is not an item alignment arranges: its path is derived from the
 * shapes its ends bind to, so moving those shapes re-routes it. A Group is an
 * item: its derived box is moved by translating the members, and its stored box
 * is never read.
 */

/** The six ways a selection can line up. */
export const ALIGNMENTS = [
  'left',
  'center-horizontal',
  'right',
  'top',
  'center-vertical',
  'bottom',
] as const;

/** One alignment an arrangement command can ask for. */
export type Alignment = (typeof ALIGNMENTS)[number];

/** The two axes distribution spaces shapes along. */
export const DISTRIBUTE_AXES = ['x', 'y'] as const;

/** One axis distribution spaces shapes along. */
export type DistributeAxis = (typeof DISTRIBUTE_AXES)[number];

/** Trims the noise arithmetic leaves behind, so stored numbers stay honest. */
const clean = (value: number): number => {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
};

/** One arrangeable shape and the box it paints into. */
type Target = {
  box: Bounds;
  shape: Shape;
};

/** The selected roots alignment may arrange: everything but a Connector. */
export const arrangeableShapes = (
  board: Board,
  selection: Selection
): Shape[] =>
  selectedRoots(board, selection).filter((shape) => shape.kind !== 'connector');

/** What a selection can be arranged with, so every surface asks one rule. */
export type Arrangement = {
  /** Whether there are two items to line up, at least one of them free to move. */
  canAlign: boolean;
  /** Whether three items can move, so the gaps between them can change. */
  canDistribute: boolean;
};

const targetsOf = (board: Board, selection: Selection): Target[] =>
  arrangeableShapes(board, selection).map((shape) => ({
    box: shapeBounds(shape, board.shapes),
    shape,
  }));

/**
 * Whether a target is free to move. A locked shape is never moved. A group is
 * atomic: a locked member makes the whole group immovable, because moving only
 * part of it would break the box its members derive.
 */
const movable = (board: Board, shape: Shape): boolean => {
  if (shape.locked) {
    return false;
  }
  if (shape.kind !== 'group') {
    return true;
  }
  const subtree = new Set(subtreeIds(board, [shape.id]));

  return !board.shapes.some(
    (member) =>
      member.id !== shape.id && member.locked && subtree.has(member.id)
  );
};

/**
 * What the selection supports: the rule the Inspector and the menu read instead
 * of counting shapes themselves. Alignment needs two targets and one that may
 * move — a locked shape is still the edge the others line up with. Distribution
 * needs three that may move, because the outer two stay put and only the ones
 * between them travel.
 */
export const arrangementOf = (
  board: Board,
  selection: Selection
): Arrangement => {
  const targets = arrangeableShapes(board, selection);
  const movableTargets = targets.filter((shape) => movable(board, shape));

  return {
    canAlign: targets.length >= 2 && movableTargets.length > 0,
    canDistribute: movableTargets.length >= 3,
  };
};

/** The distance a target's box must travel to satisfy `alignment`. */
const offsetFor = (
  alignment: Alignment,
  box: Bounds,
  frame: Bounds
): { dx: number; dy: number } => {
  if (alignment === 'left') {
    return { dx: frame.x - box.x, dy: 0 };
  }
  if (alignment === 'right') {
    return { dx: frame.x + frame.w - (box.x + box.w), dy: 0 };
  }
  if (alignment === 'center-horizontal') {
    return { dx: frame.x + frame.w / 2 - (box.x + box.w / 2), dy: 0 };
  }
  if (alignment === 'top') {
    return { dx: 0, dy: frame.y - box.y };
  }
  if (alignment === 'bottom') {
    return { dx: 0, dy: frame.y + frame.h - (box.y + box.h) };
  }
  return { dx: 0, dy: frame.y + frame.h / 2 - (box.y + box.h / 2) };
};

/** The ids one target moves: its own, or every member a group holds. */
const movedIds = (board: Board, shape: Shape): string[] =>
  shape.kind === 'group' ? subtreeIds(board, [shape.id]) : [shape.id];

/**
 * A board with every movable target put where `alignment` asks, or the same
 * board when the selection has fewer than two targets or nothing moves. A
 * Group's members travel and its stored box is left alone.
 */
export const alignBoard = (
  board: Board,
  selection: Selection,
  alignment: Alignment
): Board => {
  const targets = targetsOf(board, selection);
  const frame = boundsOfShapes(
    targets.map((target) => target.shape),
    board.shapes
  );
  if (targets.length < 2 || frame === null) {
    return board;
  }
  const byId = new Map(board.shapes.map((shape) => [shape.id, shape]));
  const replacements = new Map<string, Shape>();

  for (const target of targets) {
    if (!movable(board, target.shape)) {
      continue;
    }
    const { dx, dy } = offsetFor(alignment, target.box, frame);
    if (clean(dx) === 0 && clean(dy) === 0) {
      continue;
    }
    for (const id of movedIds(board, target.shape)) {
      const shape = byId.get(id);
      if (shape === undefined || shape.kind === 'group') {
        continue;
      }
      replacements.set(id, movedShape(shape, clean(dx), clean(dy)));
    }
  }

  return replaceShapes(board, replacements);
};

/** One target's place along `axis`, and its size on that axis. */
const spanOf = (
  box: Bounds,
  axis: DistributeAxis
): { size: number; start: number } =>
  axis === 'x' ? { size: box.w, start: box.x } : { size: box.h, start: box.y };

/**
 * A board with the movable targets on `axis` spaced by equal gaps between the
 * outermost two, or the same board when fewer than three can move or the gaps
 * already match. The outer targets stay where they are; only the middle ones
 * travel, so a selection that is already spread writes nothing.
 */
export const distributeBoard = (
  board: Board,
  selection: Selection,
  axis: DistributeAxis
): Board => {
  const targets = targetsOf(board, selection).filter((target) =>
    movable(board, target.shape)
  );
  if (targets.length < 3) {
    return board;
  }

  const sorted = [...targets].sort((a, b) => {
    const first = spanOf(a.box, axis);
    const second = spanOf(b.box, axis);
    const along = first.start - second.start;
    if (along !== 0) {
      return along;
    }
    const across = spanOf(a.box, axis === 'x' ? 'y' : 'x').start;
    const other = spanOf(b.box, axis === 'x' ? 'y' : 'x').start;

    return across - other || a.shape.id.localeCompare(b.shape.id);
  });
  const [first] = sorted;
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) {
    return board;
  }
  const leading = spanOf(first.box, axis);
  const trailing = spanOf(last.box, axis);
  const { start } = leading;
  const end = trailing.start + trailing.size;
  const total = sorted.reduce(
    (sum, target) => sum + spanOf(target.box, axis).size,
    0
  );
  const gap = (end - start - total) / (sorted.length - 1);
  const byId = new Map(board.shapes.map((shape) => [shape.id, shape]));
  const replacements = new Map<string, Shape>();
  let cursor = start + leading.size + gap;

  for (const target of sorted.slice(1, -1)) {
    const { size, start: at } = spanOf(target.box, axis);
    const delta = clean(cursor - at);
    if (delta !== 0) {
      for (const id of movedIds(board, target.shape)) {
        const shape = byId.get(id);
        if (shape === undefined || shape.kind === 'group') {
          continue;
        }
        replacements.set(
          id,
          movedShape(shape, axis === 'x' ? delta : 0, axis === 'y' ? delta : 0)
        );
      }
    }
    cursor += size + gap;
  }

  return replaceShapes(board, replacements);
};
