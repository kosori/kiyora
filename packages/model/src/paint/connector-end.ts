import type {
  Anchor,
  ConnectorShape,
  Edge,
  Endpoint,
  Shape,
} from '../board/schema';
import { formatNumber } from '../format';
import { centreOf, type Point, turn } from './figures';

/**
 * Where a connector's ends attach: the anchor an endpoint names, the one the
 * walker picks when none is named, and both ends resolved against the board.
 * The routes and the ink read these, so one resolution serves the canvas and
 * the export.
 */

const EDGE_NORMALS: Record<Edge, Point> = {
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
};

/** Keeps a value between two bounds. */
export const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/** A point written the way the artifact writes numbers. */
export const formatPoint = (point: Point): string =>
  `${formatNumber(point.x)} ${formatNumber(point.y)}`;

/** The point on a shape's box an edge and a fraction name, turned with the shape. */
export const anchorPoint = (shape: Shape, anchor: Anchor): Point => {
  const fraction = clamp(anchor.fraction, 0, 1);
  const local =
    anchor.edge === 'top'
      ? { x: shape.x + fraction * shape.w, y: shape.y }
      : anchor.edge === 'bottom'
        ? { x: shape.x + fraction * shape.w, y: shape.y + shape.h }
        : anchor.edge === 'left'
          ? { x: shape.x, y: shape.y + fraction * shape.h }
          : { x: shape.x + shape.w, y: shape.y + fraction * shape.h };

  return turn(local, centreOf(shape), shape.rotation);
};

/** The outward direction an edge faces, turned with the shape. */
const edgeDirection = (shape: Shape, edge: Edge): Point => {
  const normal = EDGE_NORMALS[edge];
  const radians = (shape.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: normal.x * cos - normal.y * sin,
    y: normal.x * sin + normal.y * cos,
  };
};

/**
 * The attachment point to use when the author names none: the edge on the shape
 * that faces `towards`, and the fraction where the centre-to-`towards` line
 * crosses that edge. The common case is therefore one drag, with nothing named.
 */
export const autoAnchor = (shape: Shape, towards: Point): Anchor => {
  const local = turn(towards, centreOf(shape), -shape.rotation);
  const centre = centreOf(shape);
  const across = shape.w === 0 ? 0 : (local.x - centre.x) / (shape.w / 2);
  const down = shape.h === 0 ? 0 : (local.y - centre.y) / (shape.h / 2);

  if (Math.abs(across) >= Math.abs(down)) {
    return {
      edge: across >= 0 ? 'right' : 'left',
      fraction:
        shape.h === 0 ? 0.5 : clamp((local.y - shape.y) / shape.h, 0, 1),
    };
  }

  return {
    edge: down >= 0 ? 'bottom' : 'top',
    fraction: shape.w === 0 ? 0.5 : clamp((local.x - shape.x) / shape.w, 0, 1),
  };
};

const findShape = (shapes: readonly Shape[], id: string): Shape | undefined =>
  shapes.find((shape) => shape.id === id);

/** The shape a bound endpoint names, when the board holds it. */
const boundShape = (
  shapes: readonly Shape[],
  endpoint: Endpoint
): Shape | undefined =>
  endpoint.kind === 'bound' ? findShape(shapes, endpoint.shapeId) : undefined;

/** A provisional point for an end, so a bound end can aim at the other. */
const seedPoint = (
  endpoint: Endpoint,
  shape: Shape | undefined,
  fallback: Point
): Point =>
  endpoint.kind === 'free'
    ? { x: endpoint.x, y: endpoint.y }
    : shape === undefined
      ? fallback
      : centreOf(shape);

/** One end of a connector, resolved against the board it is painted on. */
export type ResolvedEnd = {
  /** The attachment point, when one was named or picked. */
  anchor?: Anchor;
  /** The unit vector the line leaves by, for the curve and the heads. */
  direction: Point;
  point: Point;
  /** The shape the end is bound to, when it resolved. */
  shape?: Shape;
};

/** Both ends of a connector, resolved. */
export type ResolvedConnector = {
  from: ResolvedEnd;
  to: ResolvedEnd;
};

const resolveEnd = (
  endpoint: Endpoint,
  shape: Shape | undefined,
  towards: Point,
  fallback: Point
): ResolvedEnd => {
  if (endpoint.kind === 'free') {
    return {
      direction: { x: 0, y: 0 },
      point: { x: endpoint.x, y: endpoint.y },
    };
  }
  if (shape === undefined) {
    return { direction: { x: 0, y: 0 }, point: fallback };
  }
  const anchor = endpoint.anchor ?? autoAnchor(shape, towards);

  return {
    anchor,
    direction: edgeDirection(shape, anchor.edge),
    point: anchorPoint(shape, anchor),
    shape,
  };
};

/** A free end leaves toward the other end, so a curve still bows sensibly. */
const directionOf = (end: ResolvedEnd, other: Point): ResolvedEnd => {
  if (end.shape !== undefined) {
    return end;
  }
  const dx = other.x - end.point.x;
  const dy = other.y - end.point.y;
  const length = Math.hypot(dx, dy) || 1;

  return { ...end, direction: { x: dx / length, y: dy / length } };
};

/**
 * Both ends of a connector against the shapes it is painted with. A bound end
 * whose target is missing falls back to the connector's authored footprint, so
 * a connector drawn before its target exists is still a visible line.
 */
export const resolveConnector = (
  connector: ConnectorShape,
  shapes: readonly Shape[]
): ResolvedConnector => {
  const fromShape = boundShape(shapes, connector.from);
  const toShape = boundShape(shapes, connector.to);
  const from = resolveEnd(
    connector.from,
    fromShape,
    seedPoint(connector.to, toShape, {
      x: connector.x + connector.w,
      y: connector.y + connector.h,
    }),
    { x: connector.x, y: connector.y }
  );
  const to = resolveEnd(
    connector.to,
    toShape,
    seedPoint(connector.from, fromShape, { x: connector.x, y: connector.y }),
    { x: connector.x + connector.w, y: connector.y + connector.h }
  );

  return {
    from: directionOf(from, to.point),
    to: directionOf(to, from.point),
  };
};

const moveEndpoint = (endpoint: Endpoint, dx: number, dy: number): Endpoint =>
  endpoint.kind === 'free'
    ? { kind: 'free', x: endpoint.x + dx, y: endpoint.y + dy }
    : endpoint;

/**
 * A connector moved by a delta: its authored footprint travels and a free end
 * comes with it, while a bound end stays with the shape it names.
 */
export const moveConnector = (
  connector: ConnectorShape,
  dx: number,
  dy: number
): ConnectorShape => ({
  ...connector,
  from: moveEndpoint(connector.from, dx, dy),
  to: moveEndpoint(connector.to, dx, dy),
  x: connector.x + dx,
  y: connector.y + dy,
});

/**
 * A connector with every end bound to a doomed shape freed where it last
 * attached. The connector stays on the board and stays visible, so deleting a
 * shape never makes a line vanish silently; the author can rebind the end.
 */
export const detachConnector = (
  connector: ConnectorShape,
  shapes: readonly Shape[],
  doomed: ReadonlySet<string>
): ConnectorShape => {
  const ends = resolveConnector(connector, shapes);
  const release = (endpoint: Endpoint, point: Point): Endpoint =>
    endpoint.kind === 'bound' && doomed.has(endpoint.shapeId)
      ? { kind: 'free', x: point.x, y: point.y }
      : endpoint;
  const from = release(connector.from, ends.from.point);
  const to = release(connector.to, ends.to.point);

  return from === connector.from && to === connector.to
    ? connector
    : { ...connector, from, to };
};
