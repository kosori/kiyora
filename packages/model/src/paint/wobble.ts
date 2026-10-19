import { getStroke } from 'perfect-freehand';

/**
 * The hand-drawn overlay: a freehand ribbon traced along a shape's clean
 * geometry. It is a pure function of the shape — the geometry it traces and the
 * seed its id derives — so the same shape draws the same way on the canvas and
 * in an export, and nothing time- or randomness-based can make an artifact
 * disagree with the drawing the user saw.
 */

/** A point in board coordinates. */
export type WobblePoint = [number, number];

const LEHMER_MODULUS = 2_147_483_647;
const LEHMER_MULTIPLIER = 16_807;

/** How densely a clean path is sampled before it is jittered, in board units. */
const SAMPLE_SPACING = 5;

/** The alpha every overlay ribbon paints at, so the clean stroke reads through. */
export const WOBBLE_OPACITY = 0.66;

/**
 * A rolling Lehmer hash of a shape's identity: the same id always seeds the same
 * overlay. Geometry is not hashed, so a shape keeps its pattern as it is moved
 * or resized rather than re-rolling it on every frame.
 */
export const deriveWobbleSeed = (identity: string): number => {
  let hash = 1_103_515_245 % LEHMER_MODULUS;
  for (let index = 0; index < identity.length; index += 1) {
    hash =
      ((hash + identity.charCodeAt(index)) * LEHMER_MULTIPLIER) %
      LEHMER_MODULUS;
  }
  return hash;
};

const randomFor = (seed: number): (() => number) => {
  let state = (seed % (LEHMER_MODULUS - 1)) + 1;
  return () => {
    state = (state * LEHMER_MULTIPLIER) % LEHMER_MODULUS;
    return state / LEHMER_MODULUS;
  };
};

const sampleLine = (from: WobblePoint, to: WobblePoint): WobblePoint[] => {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / SAMPLE_SPACING)
  );
  return Array.from({ length: steps + 1 }, (_unused, index): WobblePoint => {
    const t = index / steps;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  });
};

const sampleCubic = (
  from: WobblePoint,
  first: WobblePoint,
  second: WobblePoint,
  to: WobblePoint
): WobblePoint[] => {
  const steps = Math.max(
    8,
    Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / SAMPLE_SPACING)
  );
  return Array.from({ length: steps + 1 }, (_unused, index): WobblePoint => {
    const t = index / steps;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [
      a * from[0] + b * first[0] + c * second[0] + d * to[0],
      a * from[1] + b * first[1] + c * second[1] + d * to[1],
    ];
  });
};

type Segment =
  | { type: 'move'; to: WobblePoint }
  | { type: 'line'; to: WobblePoint }
  | { type: 'cubic'; first: WobblePoint; second: WobblePoint; to: WobblePoint }
  | { type: 'close' };

const NUMBER = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

/**
 * Reads the `M`, `L`, `C` and `Z` the walker's geometry is written in. Any other
 * command is a geometry the overlay has never traced, and it fails loudly rather
 * than silently drawing a line in the wrong place.
 */
const segmentsOf = (d: string): Segment[] => {
  if (!/^[\s\dMLCZ.,eE+-]*$/.test(d)) {
    throw new Error(`wobble cannot trace a path with an unknown command: ${d}`);
  }

  const segments: Segment[] = [];
  for (const clause of d.match(/[MLCZ][^MLCZ]*/g) ?? []) {
    const command = clause[0] ?? '';
    const numbers = (clause.match(NUMBER) ?? []).map(Number);

    if (command === 'C') {
      for (let index = 0; index + 5 < numbers.length; index += 6) {
        segments.push({
          first: [numbers[index] ?? 0, numbers[index + 1] ?? 0],
          second: [numbers[index + 2] ?? 0, numbers[index + 3] ?? 0],
          to: [numbers[index + 4] ?? 0, numbers[index + 5] ?? 0],
          type: 'cubic',
        });
      }
      continue;
    }

    if (command === 'Z') {
      segments.push({ type: 'close' });
      continue;
    }

    for (let index = 0; index + 1 < numbers.length; index += 2) {
      segments.push({
        to: [numbers[index] ?? 0, numbers[index + 1] ?? 0],
        type: command === 'M' && index === 0 ? 'move' : 'line',
      });
    }
  }

  return segments;
};

/** The dense points a clean path is sampled into, and whether it closes. */
type Sample = {
  closed: boolean;
  points: WobblePoint[];
};

const samplePath = (d: string): Sample => {
  const points: WobblePoint[] = [];
  let cursor: WobblePoint = [0, 0];
  let closed = false;

  const push = (segment: WobblePoint[], skipFirst: boolean): void => {
    for (let index = skipFirst ? 1 : 0; index < segment.length; index += 1) {
      const point = segment[index];
      if (point) {
        points.push([point[0], point[1]]);
      }
    }
  };

  for (const segment of segmentsOf(d)) {
    if (segment.type === 'move') {
      cursor = segment.to;
      points.push([cursor[0], cursor[1]]);
      continue;
    }
    if (segment.type === 'close') {
      closed = true;
      const [first] = points;
      const last = points.at(-1);
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        push(sampleLine(last, first), true);
      }
      continue;
    }
    const sampled =
      segment.type === 'line'
        ? sampleLine(cursor, segment.to)
        : sampleCubic(cursor, segment.first, segment.second, segment.to);
    push(sampled, points.length > 0);
    cursor = segment.to;
  }

  const [first] = points;
  const last = points.at(-1);
  if (first && last && points.length > 2) {
    closed = closed || (first[0] === last[0] && first[1] === last[1]);
  }

  return { closed, points };
};

const round = (value: number): string => Number(value.toFixed(2)).toString();

/** The canonical freehand outline: smooth quadratics through the midpoints. */
const pathFromStroke = (outline: readonly WobblePoint[]): string => {
  const [startX = 0, startY = 0] = outline[0] ?? [];
  const parts = ['M', round(startX), round(startY), 'Q'];

  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index];
    const next = outline[(index + 1) % outline.length];
    if (!(current && next)) {
      continue;
    }
    parts.push(
      round(current[0]),
      round(current[1]),
      round((current[0] + next[0]) / 2),
      round((current[1] + next[1]) / 2)
    );
  }

  parts.push('Z');
  return parts.join(' ');
};

/**
 * The hand-drawn overlay traced over one clean path, or `null` when the path is
 * too degenerate to trace. The ribbon is drawn in the shape's own stroke colour
 * and wide enough to cover the clean line beneath it; the jitter is bounded by
 * the stroke width, so a thin stroke wobbles less than a heavy one.
 */
export const wobblePath = (
  d: string,
  seed: number,
  strokeWidth: number
): string | null => {
  const { closed, points } = samplePath(d);
  if (points.length < 2) {
    return null;
  }

  const random = randomFor(seed);
  const amplitude = Math.max(0.6, strokeWidth * 0.55);
  const jittered = points.map(
    ([x, y]): WobblePoint => [
      x + (random() * 2 - 1) * amplitude,
      y + (random() * 2 - 1) * amplitude,
    ]
  );
  const [first] = jittered;
  if (closed && first) {
    jittered[jittered.length - 1] = [first[0], first[1]];
  }

  const outline = getStroke(jittered, {
    last: closed,
    size: Math.max(4, strokeWidth * 2),
    smoothing: 0.5,
    streamline: 0.32,
    thinning: 0,
  });
  if (outline.length < 2) {
    return null;
  }

  return pathFromStroke(outline);
};
