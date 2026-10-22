import {
  type Board,
  type Bounds,
  type Shape,
  shapeBounds,
  subtreeIds,
} from '@kiyora/model';
import { type Selection, selectionBounds } from './selection';

/** The four ways a shape can sit from the selection, and the half-plane each one reads. */
export const NAVIGATION_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

/** One way the arrow keys step the selection. */
export type NavigationDirection = (typeof NAVIGATION_DIRECTIONS)[number];

/** A shape that lies in the asked-for direction, and what it costs to reach. */
type Reach = {
  /**
   * How far the candidate's centre sits off the selection's own line, in board
   * units: zero when it is within the band the selection already covers. The
   * smaller this is, the more the two line up.
   */
  across: number;
  /** The distance between the two centres along the direction of travel. */
  along: number;
  /** The candidate's paint order, so two equally near shapes always resolve the same way. */
  order: number;
  shape: Shape;
};

/** The middle of a box. */
const centreOf = (box: Bounds): { x: number; y: number } => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});

/** Whether `to`'s centre lies ahead of `from`'s, in `direction`'s half-plane. */
const ahead = (
  direction: NavigationDirection,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean => {
  const horizontal = direction === 'left' || direction === 'right';
  const forward = direction === 'down' || direction === 'right';
  const delta = horizontal ? to.x - from.x : to.y - from.y;

  return forward ? delta > 0 : delta < 0;
};

/**
 * What reaching `candidate` from `origin` costs in `direction`, or `null` when
 * it does not lie that way at all. A candidate aligned with the selection's own
 * band costs nothing across, so it wins over one that is nearer but off the
 * line; distance along the direction only separates shapes on the same line.
 */
const reachOf = (
  direction: NavigationDirection,
  origin: Bounds,
  candidate: Bounds,
  order: number,
  shape: Shape
): Reach | null => {
  const from = centreOf(origin);
  const to = centreOf(candidate);
  if (!ahead(direction, from, to)) {
    return null;
  }
  const horizontal = direction === 'left' || direction === 'right';
  const offset = horizontal ? to.y - from.y : to.x - from.x;
  const band = horizontal ? origin.h / 2 : origin.w / 2;

  return {
    across: Math.max(0, Math.abs(offset) - band),
    along: horizontal ? Math.abs(to.x - from.x) : Math.abs(to.y - from.y),
    order,
    shape,
  };
};

/** Whether `a` is reached before `b`: on its line first, then nearer, then painted first. */
const before = (a: Reach, b: Reach): boolean => {
  if (a.across !== b.across) {
    return a.across < b.across;
  }
  if (a.along !== b.along) {
    return a.along < b.along;
  }
  return a.order < b.order;
};

/**
 * Whether `shape` sits inside a group. A group moves as one thing, so the
 * keyboard reaches it by its derived box and never by the members that make it
 * up; a frame is not a group, and what it holds stays reachable.
 */
const inGroup = (shape: Shape, byId: ReadonlyMap<string, Shape>): boolean => {
  const seen = new Set<string>([shape.id]);
  let parent = shape.parentId;

  while (parent !== null) {
    if (seen.has(parent)) {
      return false;
    }
    seen.add(parent);
    const holder = byId.get(parent);
    if (holder === undefined) {
      return false;
    }
    if (holder.kind === 'group') {
      return true;
    }
    parent = holder.parentId;
  }

  return false;
};

/**
 * The nearest shape in `direction` from the selection, chosen by geometry
 * rather than paint order. A shape qualifies when its centre lies in that
 * half-plane; among those, one on the selection's own line beats one further
 * off it, and only then does the nearer centre win. Two equally near shapes
 * resolve the same way every time: the one painted first wins. A group is
 * considered as the box its members derive and its members are not candidates
 * of their own; a connector is considered by the path its ends resolve. A
 * shape held inside the selection is not a candidate, so an arrow leaves a
 * selected frame rather than stepping into it. Nothing that way is no move at
 * all — no wrap, no jump to the other edge of the board.
 */
export const nextShape = (
  board: Board,
  selection: Selection,
  direction: NavigationDirection
): Shape | null => {
  const origin = selectionBounds(board, selection);
  if (origin === null) {
    return null;
  }
  const held = new Set(subtreeIds(board, selection));
  const byId = new Map(board.shapes.map((shape) => [shape.id, shape]));
  let best: Reach | null = null;

  for (const [order, shape] of board.shapes.entries()) {
    if (held.has(shape.id) || inGroup(shape, byId)) {
      continue;
    }
    const reach = reachOf(
      direction,
      origin,
      shapeBounds(shape, board.shapes),
      order,
      shape
    );
    if (reach !== null && (best === null || before(reach, best))) {
      best = reach;
    }
  }

  return best?.shape ?? null;
};
