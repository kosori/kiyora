import { type Board, type Bounds, shapeBounds } from '@kiyora/model';

/**
 * Alignment guides: what a dragged edge lands on when the grid is not the
 * answer. Another shape offers its two edges and its centre on each axis, and a
 * guide takes the dragged box when it comes within `GUIDE_TOLERANCE`, before the
 * grid gets a say on that axis. The two axes are decided apart, so a horizontal
 * guide and a vertical guide can both win one drag while the grid still decides
 * whichever axis has no guide.
 *
 * The candidate lines are built once, when the Gesture opens, from the board as
 * it was: the shapes another shape can align to do not move during the drag.
 * They are merged per value and sorted, so every pointer move reads the
 * neighbourhood of the dragged edges with a binary search rather than a scan of
 * the board. A thousand-shape board costs one pass on pointer-down and
 * logarithmic work per frame.
 */

/** How close, in board units, a dragged edge must come before a guide takes it. */
export const GUIDE_TOLERANCE = 6;

/** The axis a guide runs along: a vertical guide is an `x` value. */
export type GuideAxis = 'x' | 'y';

/**
 * One alignment value another shape offers. `value` is where the line sits;
 * `start` and `end` are how far the shape that offers it reaches along the
 * other axis, so a guide is drawn across both boxes and not just its own.
 */
export type AlignmentLine = {
  axis: GuideAxis;
  value: number;
  start: number;
  end: number;
};

/** A guide that is active in the open Gesture, with the span it is drawn across. */
export type Guide = AlignmentLine;

/**
 * The ids to leave out: the shapes a gesture moves, and any group above them.
 * A group derives its box from its members, so a guide to one would follow the
 * shape being dragged; a frame's box is authored and does not move with what it
 * holds, so it stays a target.
 */
const excludedIds = (
  board: Board,
  moving: ReadonlySet<string>
): ReadonlySet<string> => {
  const byId = new Map(board.shapes.map((shape) => [shape.id, shape]));
  const excluded = new Set(moving);

  for (const id of moving) {
    const seen = new Set<string>();
    let parent = byId.get(id)?.parentId ?? null;
    while (parent !== null && !seen.has(parent)) {
      seen.add(parent);
      const ancestor = byId.get(parent);
      if (ancestor?.kind === 'group') {
        excluded.add(parent);
      }
      parent = ancestor?.parentId ?? null;
    }
  }

  return excluded;
};

/** One alignment line at `value` on `axis`, spanning the box on the other axis. */
const lineOf = (box: Bounds, axis: GuideAxis, value: number): AlignmentLine =>
  axis === 'x'
    ? { axis, end: box.y + box.h, start: box.y, value }
    : { axis, end: box.x + box.w, start: box.x, value };

/** One line per value and axis, spanning every shape that offers it. */
const merged = (lines: readonly AlignmentLine[]): AlignmentLine[] => {
  const sorted = [...lines].sort(
    (a, b) =>
      a.value - b.value || a.axis.localeCompare(b.axis) || a.start - b.start
  );
  const result: AlignmentLine[] = [];

  for (const line of sorted) {
    const last = result.at(-1);
    if (
      last !== undefined &&
      last.axis === line.axis &&
      last.value === line.value
    ) {
      result[result.length - 1] = {
        ...last,
        end: Math.max(last.end, line.end),
        start: Math.min(last.start, line.start),
      };
    } else {
      result.push(line);
    }
  }

  return result;
};

/**
 * Every edge and centre the board's other shapes offer, on both axes, sorted by
 * value. The moving shapes are left out, as is any group above them and every
 * connector, whose box is a derived footprint rather than an edge a person can
 * see and line up with. A locked shape is a target like any other: its edges are
 * still on the board.
 */
export const alignmentLines = (
  board: Board,
  moving: ReadonlySet<string>
): AlignmentLine[] => {
  const excluded = excludedIds(board, moving);
  const lines: AlignmentLine[] = [];

  for (const shape of board.shapes) {
    if (excluded.has(shape.id) || shape.kind === 'connector') {
      continue;
    }
    const box = shapeBounds(shape, board.shapes);
    if (box.w === 0 && box.h === 0) {
      continue;
    }
    lines.push(
      lineOf(box, 'x', box.x),
      lineOf(box, 'x', box.x + box.w / 2),
      lineOf(box, 'x', box.x + box.w),
      lineOf(box, 'y', box.y),
      lineOf(box, 'y', box.y + box.h / 2),
      lineOf(box, 'y', box.y + box.h)
    );
  }

  return merged(lines);
};

/**
 * The nearest line on `axis` within `tolerance` of `value`, or `null`. Lines are
 * sorted by value, so this searches the window the tolerance names instead of
 * the whole board.
 */
export const nearestLine = (
  lines: readonly AlignmentLine[],
  axis: GuideAxis,
  value: number,
  tolerance = GUIDE_TOLERANCE
): AlignmentLine | null => {
  const floor = value - tolerance;
  let low = 0;
  let high = lines.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const at = lines[middle];
    if (at !== undefined && at.value < floor) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  let best: AlignmentLine | null = null;
  for (let index = low; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }
    if (line.value > value + tolerance) {
      break;
    }
    if (line.axis !== axis) {
      continue;
    }
    if (
      best === null ||
      Math.abs(line.value - value) < Math.abs(best.value - value)
    ) {
      best = line;
    }
  }

  return best;
};

/** The two edges and the centre of a box on `axis`, in the order they are tried. */
const alignmentValues = (
  box: Bounds,
  axis: GuideAxis
): [number, number, number] =>
  axis === 'x'
    ? [box.x, box.x + box.w / 2, box.x + box.w]
    : [box.y, box.y + box.h / 2, box.y + box.h];

/** A line, stretched to cover the box it is guiding, so the guide reads as one line between two shapes. */
export const guideAcross = (
  line: AlignmentLine,
  start: number,
  end: number
): Guide => ({
  axis: line.axis,
  end: Math.max(line.end, end),
  start: Math.min(line.start, start),
  value: line.value,
});

/** What the guides did to one pointer move: the translation, and which axis a guide took. */
export type BoxSnap = {
  dx: number;
  dy: number;
  /** The guide that won on each axis, or `null` where the grid is still the answer. */
  x: Guide | null;
  y: Guide | null;
};

/**
 * The translation `box` needs for its edges or centre to land on a guide, per
 * axis, or the same translation when no guide is close enough. The grid is the
 * caller's fallback on any axis this returns `null` for.
 */
export const snapBox = (
  box: Bounds,
  delta: { x: number; y: number },
  lines: readonly AlignmentLine[],
  tolerance = GUIDE_TOLERANCE
): BoxSnap => {
  const moved = { ...box, x: box.x + delta.x, y: box.y + delta.y };
  const win = (axis: GuideAxis): { guide: Guide; shift: number } | null => {
    let best: { guide: Guide; shift: number } | null = null;

    for (const value of alignmentValues(moved, axis)) {
      const line = nearestLine(lines, axis, value, tolerance);
      if (line === null) {
        continue;
      }
      const shift = line.value - value;
      if (best === null || Math.abs(shift) < Math.abs(best.shift)) {
        best = {
          guide:
            axis === 'x'
              ? guideAcross(line, moved.y, moved.y + moved.h)
              : guideAcross(line, moved.x, moved.x + moved.w),
          shift,
        };
      }
    }

    return best;
  };
  const x = win('x');
  const y = win('y');

  return {
    dx: delta.x + (x?.shift ?? 0),
    dy: delta.y + (y?.shift ?? 0),
    x: x?.guide ?? null,
    y: y?.guide ?? null,
  };
};

/** Whether two guide lists say the same thing, so a gesture only republishes a real change. */
export const sameGuides = (a: readonly Guide[], b: readonly Guide[]): boolean =>
  a.length === b.length &&
  a.every((guide, index) => {
    const other = b[index];

    return (
      other !== undefined &&
      guide.axis === other.axis &&
      guide.value === other.value &&
      guide.start === other.start &&
      guide.end === other.end
    );
  });
