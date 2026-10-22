import type { ConnectorShape, Head, Shape } from '../board/schema';
import { formatNumber } from '../format';
import { type PaintText, TEXT_ASCENT } from '../text/layout';
import { parseRuns } from '../text/markdown';
import { DEFAULT_TEXT_STYLE } from '../text/style';
import { type ResolvedEnd, resolveConnector } from './connector-end';
import {
  connectorLabelPoint,
  connectorPath,
  connectorPoints,
  distanceToSegment,
} from './connector-route';
import type { Point } from './turn';

/**
 * The ink a connector draws: its line and a head at each end that asks for one,
 * plus its label. The walker styles these; the geometry comes from one endpoint
 * resolver and one route builder.
 */

/** One piece of a connector's ink: the line, or a head at one end. */
export type ConnectorInk = {
  d: string;
  /** Fill the path with the connector's stroke colour rather than `none`. */
  filled?: boolean;
  /** Whether this piece is an arrowhead rather than the line. */
  head?: boolean;
};

/** The reach, in board units, a click is allowed to miss a connector's line by. */
export const CONNECTOR_REACH = 6;

/** The size, in board units, a connector's arrowheads are drawn at. */
export const HEAD_SIZE = 12;

const formatPoint = (point: Point): string =>
  `${formatNumber(point.x)} ${formatNumber(point.y)}`;

const polar = (tip: Point, angle: number, distance: number): Point => ({
  x: tip.x + Math.cos(angle) * distance,
  y: tip.y + Math.sin(angle) * distance,
});

const BAR = (a: Point, b: Point): string =>
  `M ${formatPoint(a)} L ${formatPoint(b)}`;

const barAt = (base: Point, angle: number, half: number): string => {
  const across = { x: -Math.sin(angle), y: Math.cos(angle) };
  return BAR(
    { x: base.x + across.x * half, y: base.y + across.y * half },
    { x: base.x - across.x * half, y: base.y - across.y * half }
  );
};

const dotAt = (at: Point, radius: number): string => {
  const left = { x: at.x - radius, y: at.y };
  const right = { x: at.x + radius, y: at.y };

  return `${BAR(left, right)} A ${radius} ${radius} 0 1 0 ${formatPoint(left)} Z`;
};

const triangleAt = (tip: Point, angle: number, size: number): string => {
  const back = polar(tip, angle + Math.PI, size);
  const across = {
    x: -Math.sin(angle) * size * 0.5,
    y: Math.cos(angle) * size * 0.5,
  };

  return `M ${formatPoint(tip)} L ${formatPoint({ x: back.x + across.x, y: back.y + across.y })} L ${formatPoint({ x: back.x - across.x, y: back.y - across.y })} Z`;
};

const diamondAt = (tip: Point, angle: number, size: number): string => {
  const mid = polar(tip, angle + Math.PI, size * 0.6);
  const back = polar(tip, angle + Math.PI, size * 1.2);
  const across = {
    x: -Math.sin(angle) * size * 0.4,
    y: Math.cos(angle) * size * 0.4,
  };

  return `M ${formatPoint(tip)} L ${formatPoint({ x: mid.x + across.x, y: mid.y + across.y })} L ${formatPoint(back)} L ${formatPoint({ x: mid.x - across.x, y: mid.y - across.y })} Z`;
};

const crowFoot = (tip: Point, angle: number, size: number): string => {
  const common = polar(tip, angle + Math.PI, size);
  const across = {
    x: -Math.sin(angle) * size * 0.5,
    y: Math.cos(angle) * size * 0.5,
  };

  return [
    BAR(common, { x: tip.x + across.x, y: tip.y + across.y }),
    BAR(common, tip),
    BAR(common, { x: tip.x - across.x, y: tip.y - across.y }),
  ].join(' ');
};

/** The ink one head draws, or `null` for `none`. */
const headInk = (
  head: Head,
  tip: Point,
  angle: number,
  size: number
): ConnectorInk | null => {
  const half = size * 0.5;

  if (head === 'none') {
    return null;
  }
  if (head === 'arrow') {
    return { d: triangleAt(tip, angle, size), filled: true, head: true };
  }
  if (head === 'circle') {
    return { d: dotAt(tip, size * 0.35), filled: true, head: true };
  }
  if (head === 'cross') {
    const across = { x: Math.cos(angle) * half, y: Math.sin(angle) * half };
    const along = { x: -Math.sin(angle) * half, y: Math.cos(angle) * half };

    return {
      d: `${BAR({ x: tip.x - across.x - along.x, y: tip.y - across.y - along.y }, { x: tip.x + across.x + along.x, y: tip.y + across.y + along.y })} ${BAR({ x: tip.x - across.x + along.x, y: tip.y - across.y + along.y }, { x: tip.x + across.x - along.x, y: tip.y + across.y - along.y })}`,
      head: true,
    };
  }
  if (head === 'crow-many') {
    return { d: crowFoot(tip, angle, size), head: true };
  }
  if (head === 'crow-one') {
    return {
      d: barAt(polar(tip, angle + Math.PI, size * 0.6), angle, half),
      head: true,
    };
  }
  if (head === 'crow-one-or-many') {
    return {
      d: `${barAt(polar(tip, angle + Math.PI, size * 0.6), angle, half)} ${crowFoot(polar(tip, angle + Math.PI, size), angle, size)}`,
      head: true,
    };
  }
  if (head === 'crow-zero-or-one') {
    return {
      d: `${dotAt(polar(tip, angle + Math.PI, size * 1.2), size * 0.25)} ${barAt(polar(tip, angle + Math.PI, size * 0.6), angle, half)}`,
      head: true,
    };
  }
  if (head === 'uml-generalization') {
    return { d: triangleAt(tip, angle, size), head: true };
  }
  if (head === 'uml-composition') {
    return { d: diamondAt(tip, angle, size), filled: true, head: true };
  }
  if (head === 'uml-aggregation') {
    return { d: diamondAt(tip, angle, size), head: true };
  }

  return null;
};

/** The angle a head points: along the line, away from the end it sits on. */
const headAngle = (end: ResolvedEnd): number =>
  Math.atan2(-end.direction.y, -end.direction.x);

/** The line and its two heads, styled later by the painter. */
export const connectorInk = (
  connector: ConnectorShape,
  shapes: readonly Shape[]
): ConnectorInk[] => {
  const ends = resolveConnector(connector, shapes);
  const ink: ConnectorInk[] = [{ d: connectorPath(connector.route, ends) }];
  const start = headInk(
    connector.start,
    ends.from.point,
    headAngle(ends.from),
    HEAD_SIZE
  );
  const end = headInk(
    connector.end,
    ends.to.point,
    headAngle(ends.to),
    HEAD_SIZE
  );

  if (start !== null) {
    ink.push(start);
  }
  if (end !== null) {
    ink.push(end);
  }

  return ink;
};

/** The label a connector carries, placed on its route and drawn in `fill`. */
export const connectorLabel = (
  connector: ConnectorShape,
  shapes: readonly Shape[],
  fill: string
): PaintText[] => {
  const source = connector.text;
  if (source === undefined || source === '') {
    return [];
  }
  const style = connector.textStyle ?? DEFAULT_TEXT_STYLE;
  const runs = parseRuns(source);
  if (runs.length === 0) {
    return [];
  }
  const at = connectorLabelPoint(connector, shapes);

  return [
    {
      align: 'center',
      fill,
      runs,
      size: style.size,
      x: at.x,
      y: at.y + style.size * TEXT_ASCENT * 0.5,
    },
  ];
};

/** Whether a board point lands on a connector's line, within `reach`. */
export const connectorAt = (
  connector: ConnectorShape,
  shapes: readonly Shape[],
  point: Point,
  reach: number
): boolean => {
  const points = connectorPoints(
    connector.route,
    resolveConnector(connector, shapes)
  );

  return points.some(
    (at, index) =>
      index > 0 &&
      distanceToSegment(point, points[index - 1] ?? at, at) <= reach
  );
};
