import type { InkMode, InkShape, Style } from '../board/schema';
import { formatNumber } from '../format';
import { turn } from '../paint/turn';

/** A point on a stroke while it is being drawn, in board coordinates. */
export type InkStrokePoint = {
  x: number;
  y: number;
  pressure?: number;
};

/** How close two samples must be, in screen pixels, before the later one is dropped. */
export const INK_MIN_STEP = 1.5;

/** The most points one stroke may keep, so a long stroke cannot grow without bound. */
export const MAX_INK_POINTS = 512;

/** How much wider a highlighter is than the pen width it was drawn with. */
export const INK_HIGHLIGHTER_SCALE = 5;

/** The alpha a highlighter paints at, before the shape's own opacity. */
export const INK_HIGHLIGHTER_ALPHA = 0.35;

/** How much of a point's full width survives at zero pressure, so a light touch still inks. */
const PRESSURE_FLOOR = 0.35;

/** How near a click must land to a stroke, in board units beyond its own width. */
export const INK_REACH = 6;

const distance = (a: InkStrokePoint, b: InkStrokePoint): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/**
 * One stroke reduced to the points worth storing. Endpoints always survive, a
 * sample closer than `minStep` to the last kept one is dropped, and a stroke
 * longer than `MAX_INK_POINTS` is thinned evenly, so hundreds of pointer samples
 * do not become hundreds of stored points. Pressure travels on the points that
 * survive; nothing reconstructs or invents it.
 */
export const simplifyStroke = (
  points: readonly InkStrokePoint[],
  minStep: number
): InkStrokePoint[] => {
  const [first] = points;
  const last = points.at(-1);
  if (first === undefined || last === undefined) {
    return [];
  }
  if (points.length <= 2) {
    return [...points];
  }

  const kept = [first];
  let previous = first;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (point !== undefined && distance(previous, point) >= minStep) {
      kept.push(point);
      previous = point;
    }
  }
  kept.push(last);

  if (kept.length <= MAX_INK_POINTS) {
    return kept;
  }

  const step = (kept.length - 1) / (MAX_INK_POINTS - 1);
  return Array.from(
    { length: MAX_INK_POINTS },
    (_, index) => kept[Math.round(index * step)] as InkStrokePoint
  );
};

/**
 * One sample added to a stroke: dropped when it is too close to the last, and
 * replacing the last once the cap is reached. The first point and the growing
 * end therefore always survive, which is what `simplifyStroke` promises too.
 */
export const addStrokePoint = (
  points: readonly InkStrokePoint[],
  point: InkStrokePoint,
  minStep: number
): InkStrokePoint[] => {
  const last = points.at(-1);
  if (last !== undefined && distance(last, point) < minStep) {
    return [...points];
  }
  if (points.length >= MAX_INK_POINTS) {
    return [...points.slice(0, -1), point];
  }
  return [...points, point];
};

/**
 * The ink shape a finished or in-progress stroke means: its box is the extent of
 * the points, and every point is stored as a fraction of that box, so a move,
 * resize or rotation of the box carries the stroke with it.
 */
export const inkFromStroke = (
  id: string,
  mode: InkMode,
  style: Style,
  stroke: readonly InkStrokePoint[],
  parentId: string | null = null
): InkShape => {
  const [first] = stroke;
  if (first === undefined) {
    throw new Error('an ink stroke needs at least one point');
  }

  const xs = stroke.map((point) => point.x);
  const ys = stroke.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;

  return {
    h,
    id,
    kind: 'ink',
    locked: false,
    mode,
    opacity: 1,
    parentId,
    points: stroke.map((point) => ({
      x: w === 0 ? 0 : (point.x - x) / w,
      y: h === 0 ? 0 : (point.y - y) / h,
      ...(point.pressure === undefined ? {} : { pressure: point.pressure }),
    })),
    rotation: 0,
    style,
    w,
    x,
    y,
  };
};

/** The stroke's points in board coordinates, before its rotation is applied. */
export const inkPoints = (shape: InkShape): InkStrokePoint[] =>
  shape.points.map((point) => ({
    x: shape.x + point.x * shape.w,
    y: shape.y + point.y * shape.h,
    ...(point.pressure === undefined ? {} : { pressure: point.pressure }),
  }));

/**
 * The width at each point. A stroke the device reported pressure for tapers with
 * it; a stroke with no pressure keeps one width, because a mouse's constant half
 * press is not a pressure to shape the line with.
 */
export const inkWidths = (shape: InkShape): number[] => {
  const base =
    Math.max(shape.style.strokeWidth, 0.75) *
    (shape.mode === 'highlighter' ? INK_HIGHLIGHTER_SCALE : 1);

  return shape.points.map((point) =>
    point.pressure === undefined
      ? base
      : base * (PRESSURE_FLOOR + (1 - PRESSURE_FLOOR) * point.pressure)
  );
};

/** How far the widest part of the stroke reaches beyond its authored box. */
export const inkMargin = (shape: InkShape): number =>
  Math.max(...inkWidths(shape)) / 2;

/** One point's width, used to round a single-sample dot. */
const dotRadius = (shape: InkShape): number =>
  Math.max(inkMargin(shape), 0.375);

/**
 * The stroke as one closed outline. Pressure-aware widths become the offsets on
 * each side of the path, and the ends are round caps, so a pen tapers and a
 * highlighter reads as one broad band; a stroke with no pressure produces the
 * same shape at one width throughout. One path per stroke keeps a long stroke
 * one DOM node and one exported element.
 */
export const inkPath = (shape: InkShape): string => {
  const points = inkPoints(shape);
  const widths = inkWidths(shape);
  const [first] = points;

  if (first === undefined) {
    return '';
  }
  if (points.length === 1) {
    const radius = dotRadius(shape);
    const left = formatNumber(first.x - radius);
    const diameter = formatNumber(radius * 2);
    const back = formatNumber(-radius * 2);

    return `M ${left} ${formatNumber(first.y)} a ${formatNumber(radius)} ${formatNumber(radius)} 0 1 0 ${diameter} 0 a ${formatNumber(radius)} ${formatNumber(radius)} 0 1 0 ${back} 0 Z`;
  }

  const left = points.map((point, index) => {
    const before = points[Math.max(0, index - 1)] as InkStrokePoint;
    const after = points[
      Math.min(points.length - 1, index + 1)
    ] as InkStrokePoint;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const reach = (widths[index] ?? 0) / 2;

    return {
      x: point.x - (dy / length) * reach,
      y: point.y + (dx / length) * reach,
    };
  });
  const right = points.map((point, index) => {
    const before = points[Math.max(0, index - 1)] as InkStrokePoint;
    const after = points[
      Math.min(points.length - 1, index + 1)
    ] as InkStrokePoint;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const reach = (widths[index] ?? 0) / 2;

    return {
      x: point.x + (dy / length) * reach,
      y: point.y - (dx / length) * reach,
    };
  });

  const at = (point: { x: number; y: number }): string =>
    `${formatNumber(point.x)} ${formatNumber(point.y)}`;
  const cap = (radius: number): string =>
    `A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1`;
  const start = left[0] as { x: number; y: number };
  const startRight = right[0] as { x: number; y: number };
  const endLeft = left.at(-1) as { x: number; y: number };
  const forward = right.slice(1).map((point) => `L ${at(point)}`);
  const back = left
    .slice(1, -1)
    .reverse()
    .map((point) => `L ${at(point)}`);

  return [
    `M ${at(start)}`,
    `${cap((widths[0] ?? 0) / 2)} ${at(startRight)}`,
    ...forward,
    `${cap((widths.at(-1) ?? 0) / 2)} ${at(endLeft)}`,
    ...back,
    'Z',
  ].join(' ');
};

const segmentDistance = (
  point: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number }
): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - from.x, point.y - from.y);
  }
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared
    )
  );

  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
};

/**
 * Whether `point` lands on the stroke as painted: near its line, within its own
 * half width plus `reach`, with the shape's rotation turned back first. A stroke
 * is picked where it is drawn rather than by the loose box around it.
 */
export const inkAt = (
  shape: InkShape,
  point: { x: number; y: number },
  reach: number
): boolean => {
  const centre = { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
  const local = turn(point, centre, -shape.rotation);
  const points = inkPoints(shape);
  const tolerance = inkMargin(shape) + reach;
  const [first] = points;

  if (first === undefined) {
    return false;
  }
  if (points.length === 1) {
    return Math.hypot(local.x - first.x, local.y - first.y) <= tolerance;
  }

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1] as InkStrokePoint;
    const to = points[index] as InkStrokePoint;
    if (segmentDistance(local, from, to) <= tolerance) {
      return true;
    }
  }
  return false;
};
