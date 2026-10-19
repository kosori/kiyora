import {
  type Anchor,
  anchorPoint,
  type Board,
  type ConnectorShape,
  connectorInk,
  connectorPath,
  type Paint,
  paintBoard,
  parseBoard,
  projectBoard,
  ROUTES,
  resolveConnector,
  SCHEMA_VERSION,
  type Shape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const rectangle = (overrides: Partial<Shape> = {}): Shape =>
  ({
    h: 60,
    id: 'a',
    kind: 'rectangle',
    locked: false,
    opacity: 1,
    parentId: null,
    rotation: 0,
    style,
    w: 100,
    x: 0,
    y: 0,
    ...overrides,
  }) as Shape;

const connector = (overrides: Partial<ConnectorShape> = {}): ConnectorShape =>
  ({
    end: 'arrow',
    from: { kind: 'bound', shapeId: 'a' },
    h: 0,
    id: 'connector-1',
    kind: 'connector',
    locked: false,
    opacity: 1,
    parentId: null,
    rotation: 0,
    route: 'straight',
    start: 'none',
    style,
    to: { kind: 'bound', shapeId: 'b' },
    w: 0,
    x: 0,
    y: 0,
    ...overrides,
  }) as ConnectorShape;

const board = (shapes: Shape[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Board',
    updatedAt: 1_700_000_000_000,
  });

describe('choosing an attachment point', () => {
  it('names the point an edge and a fraction pick, turned with the shape', () => {
    const turned = rectangle({ h: 200, rotation: 90, w: 100, x: 0, y: 0 });

    expect(anchorPoint(rectangle(), { edge: 'right', fraction: 0.5 })).toEqual({
      x: 100,
      y: 30,
    });
    expect(anchorPoint(rectangle(), { edge: 'top', fraction: 0.25 })).toEqual({
      x: 25,
      y: 0,
    });
    expect(anchorPoint(turned, { edge: 'top', fraction: 0.5 })).toEqual({
      x: 150,
      y: 100,
    });
  });

  it('is picked for the author: the end faces the other end', () => {
    const resolved = resolveConnector(
      connector(),
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 300, y: 0 }),
      ]).shapes
    );

    expect(resolved.from.anchor).toEqual({ edge: 'right', fraction: 0.5 });
    expect(resolved.from.point).toEqual({ x: 100, y: 30 });
    expect(resolved.to.anchor).toEqual({ edge: 'left', fraction: 0.5 });
    expect(resolved.to.point).toEqual({ x: 300, y: 30 });
  });

  it('honours an attachment point the author named', () => {
    const named: Anchor = { edge: 'bottom', fraction: 1 };
    const resolved = resolveConnector(
      connector({ from: { anchor: named, kind: 'bound', shapeId: 'a' } }),
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 300 })]).shapes
    );

    expect(resolved.from.anchor).toEqual(named);
    expect(resolved.from.point).toEqual({ x: 100, y: 60 });
  });

  it('stands a free end at its own coordinate', () => {
    const resolved = resolveConnector(
      connector({ to: { kind: 'free', x: 420, y: 90 } }),
      board([rectangle({ id: 'a' })]).shapes
    );

    expect(resolved.to.point).toEqual({ x: 420, y: 90 });
    expect(resolved.to.anchor).toBeUndefined();
  });
});

describe('routing a connector', () => {
  const { shapes } = board([
    rectangle({ id: 'a', x: 0, y: 0 }),
    rectangle({ id: 'b', x: 300, y: 0 }),
  ]);

  it('draws a straight line between the two ends', () => {
    const ends = resolveConnector(connector({ route: 'straight' }), shapes);

    expect(connectorPath('straight', ends)).toBe('M 100 30 L 300 30');
  });

  it('draws a curve bowed by the ends, distinct from a line', () => {
    const ends = resolveConnector(connector({ route: 'curved' }), shapes);
    const d = connectorPath('curved', ends);

    expect(d).toContain('C');
    expect(d).not.toContain('L');
  });

  it('draws an elbow of axis-aligned segments', () => {
    const below = board([
      rectangle({ id: 'a', x: 0, y: 0 }),
      rectangle({ id: 'b', x: 300, y: 150 }),
    ]).shapes;
    const ends = resolveConnector(connector({ route: 'elbow' }), below);

    expect(connectorPath('elbow', ends)).toBe(
      'M 100 60 L 200 60 L 200 150 L 300 150'
    );
  });

  it('offers exactly the three routes the ticket names', () => {
    expect(ROUTES).toEqual(['straight', 'curved', 'elbow']);
  });
});

describe('re-routing when a bound shape moves', () => {
  it('recomputes the path from the board, so no repair pass is needed', () => {
    const { shapes } = board([
      rectangle({ id: 'a', x: 0, y: 0 }),
      rectangle({ id: 'b', x: 300, y: 0 }),
    ]);
    const before = connectorPath(
      'straight',
      resolveConnector(connector(), shapes)
    );

    const moved = shapes.map((shape) =>
      shape.id === 'b' ? { ...shape, x: 300, y: 200 } : shape
    );
    const after = connectorPath(
      'straight',
      resolveConnector(connector(), moved)
    );

    expect(before).toBe('M 100 30 L 300 30');
    expect(after).not.toBe(before);
  });
});

describe('falling back when a bound target cannot be found', () => {
  it('keeps the connector visible at its authored footprint', () => {
    const resolved = resolveConnector(
      connector({ h: 60, w: 300, x: 10, y: 20 }),
      board([]).shapes
    );

    expect(resolved.from.point).toEqual({ x: 10, y: 20 });
    expect(resolved.to.point).toEqual({ x: 310, y: 80 });
  });
});

describe('heads, chosen per end', () => {
  const { shapes } = board([
    rectangle({ id: 'a', x: 0, y: 0 }),
    rectangle({ id: 'b', x: 300, y: 0 }),
  ]);

  it('draws a head only at the end that asks for one', () => {
    const ink = connectorInk(
      connector({ end: 'arrow', start: 'none' }),
      shapes
    );

    expect(ink.filter((part) => part.head)).toHaveLength(1);
  });

  it('draws an independent head at each end', () => {
    const ink = connectorInk(
      connector({ end: 'arrow', start: 'circle' }),
      shapes
    );

    expect(ink.filter((part) => part.head)).toHaveLength(2);
  });

  it('draws no head at all when both ends are none', () => {
    const ink = connectorInk(connector({ end: 'none', start: 'none' }), shapes);

    expect(ink.filter((part) => part.head)).toHaveLength(0);
  });
});

const light = { theme: 'light' } as const;

/** A board of two joined shapes plus the connector, in the route asked for. */
const joined = (route: 'straight' | 'curved' | 'elbow'): Shape[] => [
  rectangle({ id: 'a', x: 0, y: 0 }),
  rectangle({ id: 'b', x: 300, y: 0 }),
  connector({ route }),
];

/** The painted node of the connector, found by the id it is keyed on. */
const connectorNode = (
  shapes: Shape[],
  id = 'connector-1'
): Paint | undefined =>
  paintBoard(board(shapes), light).children.find((node) => node.shapeId === id);

/** The coordinate pairs in a path's `d`, which is all a traced ribbon carries. */
const coordinates = (d: string): [number, number][] => {
  const values = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const points: [number, number][] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    points.push([values[index] ?? 0, values[index + 1] ?? 0]);
  }
  return points;
};

describe('the hand-drawn overlay on a connector', () => {
  it.each(['straight', 'curved', 'elbow'] as const)(
    'traces the %s route with a ribbon, so the line reads as drawn',
    (route) => {
      const overlays = connectorNode(joined(route))?.paths.filter(
        (path) => path.overlay
      );

      expect(overlays).toHaveLength(1);
      expect(overlays?.[0]?.fill).toBeDefined();
      expect(overlays?.[0]?.fill).not.toBe('none');
    }
  );

  it('draws the ribbon over the line but under the head, so the arrowhead keeps its ink', () => {
    const paths = connectorNode(joined('straight'))?.paths ?? [];
    const ribbon = paths.findIndex((path) => path.overlay === true);
    const head = paths.findIndex(
      (path) => path.overlay !== true && path.fill !== 'none'
    );

    expect(paths[0]?.overlay).toBeUndefined();
    expect(ribbon).toBeGreaterThan(0);
    expect(head).toBeGreaterThan(ribbon);
    expect(paths[head]?.d).toContain('Z');
  });

  it('keeps its pattern when both endpoints move, because the seed is the id', () => {
    const before = connectorNode(joined('straight'));
    const moved = joined('straight').map((shape) => ({
      ...shape,
      x: shape.x + 200,
      y: shape.y + 50,
    }));
    const after = connectorNode(moved);
    const ribbon = (node: Paint | undefined): [number, number][] =>
      coordinates(node?.paths.find((path) => path.overlay)?.d ?? '');
    const beforeRibbon = ribbon(before);
    const afterRibbon = ribbon(after);

    expect(beforeRibbon.length).toBeGreaterThan(3);
    expect(afterRibbon).toHaveLength(beforeRibbon.length);
    for (let index = 0; index < beforeRibbon.length; index += 1) {
      expect(
        (afterRibbon[index]?.[0] ?? 0) - (beforeRibbon[index]?.[0] ?? 0)
      ).toBeCloseTo(200, 1);
      expect(
        (afterRibbon[index]?.[1] ?? 0) - (beforeRibbon[index]?.[1] ?? 0)
      ).toBeCloseTo(50, 1);
    }
  });

  it('draws two identically routed connectors differently, because each is seeded by its own id', () => {
    const first = connectorNode(joined('straight'));
    const renamed = joined('straight').map((shape) =>
      shape.id === 'connector-1' ? { ...shape, id: 'connector-2' } : shape
    );
    const second = connectorNode(renamed, 'connector-2');

    expect(first?.paths.find((path) => path.overlay)?.d).toBeDefined();
    expect(second?.paths.find((path) => path.overlay)?.d).toBeDefined();
    expect(first?.paths.find((path) => path.overlay)?.d).not.toBe(
      second?.paths.find((path) => path.overlay)?.d
    );
  });

  it('keeps the ribbon in the artifact, so the export is the drawing the user saw', () => {
    const lone = {
      ...connector(),
      from: { kind: 'free' as const, x: 0, y: 0 },
      to: { kind: 'free' as const, x: 200, y: 100 },
    };
    const svg = projectBoard(board([lone]), light);

    expect(svg.match(/data-wobble="true"/g)).toHaveLength(1);
  });
});
