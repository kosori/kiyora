import {
  addStrokePoint,
  type Board,
  INK_MIN_STEP,
  type InkMode,
  type InkShape,
  type InkStrokePoint,
  inkFromStroke,
  nextId,
  type Style,
  simplifyStroke,
} from '@kiyora/model';
import type { Point } from './camera';
import { addShape } from './containment';
import { replaceShapes } from './shape-edit';

/**
 * The open ink stroke: the board it began on, the board it placed its first dot
 * on, the samples collected so far, and the rule that decides which of them are
 * worth storing. It lives only while the pointer is down, so a stroke is one
 * gesture and one history entry however many samples it gathered.
 */
export type InkDrag = {
  /** The board before the stroke, restored by a cancel and committed against on up. */
  before: Board;
  /** The board with the stroke's first dot already placed, its parent settled. */
  base: Board;
  id: string;
  kind: 'ink';
  /** The shortest gap worth storing, in board units at the zoom the stroke began on. */
  minStep: number;
  mode: InkMode;
  parentId: string | null;
  points: InkStrokePoint[];
  style: Style;
};

/** One pointer sample, carrying pressure only when the device reported one. */
export const strokePoint = (
  point: Point,
  pressure?: number
): InkStrokePoint => ({
  x: point.x,
  y: point.y,
  ...(pressure === undefined ? {} : { pressure }),
});

const shapeOf = (drag: InkDrag, points: readonly InkStrokePoint[]): InkShape =>
  inkFromStroke(
    drag.id,
    drag.mode,
    drag.style,
    simplifyStroke(points, drag.minStep),
    drag.parentId
  );

/**
 * The drag a pen or highlighter opens at `point`: the stroke's id, its mode, the
 * style it wears and its first sample. A click that never moves is therefore a
 * dot, authored like any other stroke, and it costs one history entry.
 */
export const beginInk = (
  board: Board,
  mode: InkMode,
  style: Style,
  point: Point,
  pressure: number | undefined,
  zoom: number
): { board: Board; drag: InkDrag } => {
  const used = new Set(board.shapes.map((shape) => shape.id));
  const id = nextId(mode === 'pen' ? 'ink' : 'highlighter', used);
  const points = [strokePoint(point, pressure)];
  const placed = addShape(board, inkFromStroke(id, mode, style, points));
  const parentId = placed.shapes.at(-1)?.parentId ?? null;
  const drag: InkDrag = {
    base: placed,
    before: board,
    id,
    kind: 'ink',
    minStep: INK_MIN_STEP / Math.max(zoom, 0.01),
    mode,
    parentId,
    points,
    style,
  };

  return { board: placed, drag };
};

/** One more sample: the board now paints the stroke simplified, the drag keeps every sample. */
export const extendInk = (
  drag: InkDrag,
  point: Point,
  pressure: number | undefined
): { board: Board; drag: InkDrag } => {
  const points = addStrokePoint(
    drag.points,
    strokePoint(point, pressure),
    drag.minStep
  );
  const next: InkDrag = { ...drag, points };

  return {
    board: replaceShapes(
      drag.base,
      new Map([[drag.id, shapeOf(next, points)]])
    ),
    drag: next,
  };
};

/** The board the lifted pointer leaves: the stroke simplified once more, endpoint included. */
export const finishInk = (drag: InkDrag): Board =>
  replaceShapes(drag.base, new Map([[drag.id, shapeOf(drag, drag.points)]]));
