import type { ConnectorShape, Route, Shape } from '../board/schema';
import { DEFAULT_TEXT_STYLE } from '../text/style';
import {
  clamp,
  formatPoint,
  type ResolvedConnector,
  resolveConnector,
} from './connector-end';
import type { Bounds, Point } from './figures';

/**
 * How a connector's line travels: the points a route passes through, its `d`,
 * the box it paints into and where its label sits. One route builder serves the
 * canvas, the export and hit-testing, so there is no second edge-path builder.
 */

const dedupe = (points: Point[]): Point[] =>
  points.filter(
    (point, index) =>
      index === 0 ||
      point.x !== points[index - 1]?.x ||
      point.y !== points[index - 1]?.y
  );

const elbowPoints = ({ from, to }: ResolvedConnector): Point[] => {
  const dx = to.point.x - from.point.x;
  const dy = to.point.y - from.point.y;
  const corners =
    Math.abs(dx) >= Math.abs(dy)
      ? [
          { x: (from.point.x + to.point.x) / 2, y: from.point.y },
          { x: (from.point.x + to.point.x) / 2, y: to.point.y },
        ]
      : [
          { x: from.point.x, y: (from.point.y + to.point.y) / 2 },
          { x: to.point.x, y: (from.point.y + to.point.y) / 2 },
        ];

  return dedupe([from.point, ...corners, to.point]);
};

const curveControls = ({ from, to }: ResolvedConnector): [Point, Point] => {
  const reach =
    Math.max(
      1,
      Math.hypot(to.point.x - from.point.x, to.point.y - from.point.y)
    ) / 2;

  return [
    {
      x: from.point.x + from.direction.x * reach,
      y: from.point.y + from.direction.y * reach,
    },
    {
      x: to.point.x + to.direction.x * reach,
      y: to.point.y + to.direction.y * reach,
    },
  ];
};

const CURVE_STEPS = 16;

const sampleCurve = (ends: ResolvedConnector): Point[] => {
  const [c1, c2] = curveControls(ends);
  const from = ends.from.point;
  const to = ends.to.point;

  return Array.from({ length: CURVE_STEPS + 1 }, (_unused, index) => {
    const t = index / CURVE_STEPS;
    const u = 1 - t;

    return {
      x:
        u * u * u * from.x +
        3 * u * u * t * c1.x +
        3 * u * t * t * c2.x +
        t * t * t * to.x,
      y:
        u * u * u * from.y +
        3 * u * u * t * c1.y +
        3 * u * t * t * c2.y +
        t * t * t * to.y,
    };
  });
};

/** The points a route passes through, so bounds and hit-testing share one shape. */
export const connectorPoints = (
  route: Route,
  ends: ResolvedConnector
): Point[] => {
  if (route === 'straight') {
    return [ends.from.point, ends.to.point];
  }
  return route === 'elbow' ? elbowPoints(ends) : sampleCurve(ends);
};

/** The `d` a route draws between its ends. */
export const connectorPath = (
  route: Route,
  ends: ResolvedConnector
): string => {
  if (route === 'curved') {
    const [c1, c2] = curveControls(ends);
    return `M ${formatPoint(ends.from.point)} C ${formatPoint(c1)} ${formatPoint(c2)} ${formatPoint(ends.to.point)}`;
  }

  return connectorPoints(route, ends)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${formatPoint(point)}`)
    .join(' ');
};

/** A point a fraction of the way along a route, by its own length. */
const pointAlong = (points: readonly Point[], at: number): Point => {
  const spans = points.slice(1).map((point, index) => {
    const from = points[index] ?? point;
    return {
      from,
      length: Math.hypot(point.x - from.x, point.y - from.y),
      to: point,
    };
  });
  const total = spans.reduce((sum, span) => sum + span.length, 0);
  let left = total * at;

  for (const span of spans) {
    if (left <= span.length || span === spans.at(-1)) {
      const ratio = span.length === 0 ? 0 : left / span.length;
      return {
        x: span.from.x + (span.to.x - span.from.x) * ratio,
        y: span.from.y + (span.to.y - span.from.y) * ratio,
      };
    }
    left -= span.length;
  }

  return points.at(-1) ?? { x: 0, y: 0 };
};

/** The point a connector's label sits at: the middle of its route, lifted clear. */
export const connectorLabelPoint = (
  connector: ConnectorShape,
  shapes: readonly Shape[]
): Point => {
  const ends = resolveConnector(connector, shapes);
  const points = connectorPoints(connector.route, ends);
  const middle = pointAlong(points, 0.5);
  const before = pointAlong(points, 0.49);
  const tangent = { x: middle.x - before.x, y: middle.y - before.y };
  const length = Math.hypot(tangent.x, tangent.y) || 1;
  const normal = { x: -tangent.y / length, y: tangent.x / length };
  const upward = normal.y > 0 ? { x: -normal.x, y: -normal.y } : normal;
  const lift = (connector.textStyle ?? DEFAULT_TEXT_STYLE).size * 0.9;

  return {
    x: middle.x + upward.x * lift,
    y: middle.y + upward.y * lift,
  };
};

/** The box a connector paints into: the span of the route it draws. */
export const connectorBounds = (
  connector: ConnectorShape,
  shapes: readonly Shape[]
): Bounds => {
  const points = connectorPoints(
    connector.route,
    resolveConnector(connector, shapes)
  );
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { h: Math.max(...ys) - y, w: Math.max(...xs) - x, x, y };
};

/** Distance from `point` to the segment `from`–`to`. */
export const distanceToSegment = (
  point: Point,
  from: Point,
  to: Point
): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  if (length === 0) {
    return Math.hypot(point.x - from.x, point.y - from.y);
  }
  const t = clamp(
    ((point.x - from.x) * dx + (point.y - from.y) * dy) / length,
    0,
    1
  );
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
};
