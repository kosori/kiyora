import {
  type Board,
  type ConnectorShape,
  type Paint,
  type PaintContext,
  paintBoard,
  parseBoard,
  SCHEMA_VERSION,
  type Shape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'green',
  fillStyle: 'bold',
  stroke: 'green',
  strokeWidth: 2,
} as const;

const rectangle = (overrides: Partial<Shape> = {}): Shape =>
  ({
    h: 60,
    id: 'rectangle-1',
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

const frame = (overrides: Partial<Shape> = {}): Shape =>
  ({
    ...rectangle(overrides),
    clip: true,
    kind: 'frame',
    variant: 'plain',
  }) as Shape;

const connector = (overrides: Partial<ConnectorShape> = {}): ConnectorShape =>
  ({
    end: 'arrow',
    from: { kind: 'bound', shapeId: 'left' },
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
    to: { kind: 'bound', shapeId: 'right' },
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
    title: 'Untitled',
    updatedAt: 1_700_000_000_000,
  });

/** The view holding the board's origin and one stroke of it, in board units. */
const atOrigin = { h: 100, w: 100, x: 0, y: 0 };

const light: PaintContext = { theme: 'light' };

/** The ids a painted board holds at every depth, in paint order. */
const ids = (paint: Paint): string[] => [
  ...(paint.shapeId === undefined ? [] : [paint.shapeId]),
  ...paint.children.flatMap(ids),
];

describe('painting through a view', () => {
  it('keeps the shape under the view and drops one that cannot reach it', () => {
    const drawn = board([
      rectangle({ id: 'under-the-view' }),
      rectangle({ id: 'far-away', x: 5000 }),
    ]);

    expect(ids(paintBoard(drawn, { ...light, view: atOrigin }))).toEqual([
      'under-the-view',
    ]);
  });

  it('paints the whole board when no view is given, so an artifact culls nothing', () => {
    const drawn = board([
      rectangle({ id: 'under-the-view' }),
      rectangle({ id: 'far-away', x: 5000 }),
    ]);

    expect(ids(paintBoard(drawn, light))).toEqual([
      'under-the-view',
      'far-away',
    ]);
  });

  it('keeps a shape the view cuts through, so an edge cannot pop out', () => {
    const drawn = board([rectangle({ h: 400, id: 'crossing', x: 80 })]);

    expect(ids(paintBoard(drawn, { ...light, view: atOrigin }))).toEqual([
      'crossing',
    ]);
  });

  it('keeps a connector whose line crosses the view while its ends sit far off', () => {
    const drawn = board([
      rectangle({ id: 'left', x: -2000 }),
      rectangle({ id: 'right', x: 2000 }),
      connector({}),
    ]);

    expect(ids(paintBoard(drawn, { ...light, view: atOrigin }))).toEqual([
      'connector-1',
    ]);
  });

  it('keeps the frame that holds a visible member, so the member stays nested', () => {
    const drawn = board([
      frame({ h: 400, id: 'frame-1', x: -1000 }),
      rectangle({ id: 'member-1', parentId: 'frame-1' }),
    ]);

    const paint = paintBoard(drawn, { ...light, view: atOrigin });

    expect(paint.children.map((child) => child.shapeId)).toEqual(['frame-1']);
    expect(paint.children[0]?.children.map((child) => child.shapeId)).toEqual([
      'member-1',
    ]);
  });

  it('drops a member the view cannot reach even when its frame is in view', () => {
    const drawn = board([
      frame({ h: 400, id: 'frame-1' }),
      rectangle({ id: 'member-1', parentId: 'frame-1' }),
      rectangle({ id: 'member-far', parentId: 'frame-1', x: 3000 }),
    ]);

    const paint = paintBoard(drawn, { ...light, view: atOrigin });

    expect(paint.children[0]?.children.map((child) => child.shapeId)).toEqual([
      'member-1',
    ]);
  });

  it('judges a turned shape by its turned box, not the authored one', () => {
    const drawn = board([
      rectangle({ h: 40, id: 'turned', rotation: 45, w: 40, x: -45, y: 30 }),
    ]);

    expect(ids(paintBoard(drawn, light))).toEqual(['turned']);
    expect(ids(paintBoard(drawn, { ...light, view: atOrigin }))).toEqual([
      'turned',
    ]);
  });
});
