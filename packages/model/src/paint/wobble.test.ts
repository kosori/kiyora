import {
  type Board,
  deriveWobbleSeed,
  FIGURE_KINDS,
  type FigureKind,
  type FigureShape,
  type Paint,
  type PaintContext,
  paintBoard,
  paintShape,
  parseBoard,
  projectBoard,
  SCHEMA_VERSION,
  wobblePath,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

const figure = (
  kind: FigureKind,
  overrides: Partial<FigureShape> = {}
): FigureShape => ({
  h: 80,
  id: `figure-${kind}`,
  kind,
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'blue',
    fillStyle: 'pastel',
    stroke: 'ink',
    strokeWidth: 2,
  },
  w: 120,
  x: 0,
  y: 0,
  ...overrides,
});

const frame = (overrides: Record<string, unknown> = {}) => ({
  ...figure('rectangle', overrides as Partial<FigureShape>),
  clip: true,
  kind: 'frame' as const,
  variant: 'plain' as const,
});

const board = (shapes: unknown[]): Board =>
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

const overlays = (paint: Paint) => paint.paths.filter((path) => path.overlay);

const coordinates = (d: string): [number, number][] => {
  const values = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const points: [number, number][] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    points.push([values[index] ?? 0, values[index + 1] ?? 0]);
  }
  return points;
};

describe('seeding the hand-drawn overlay', () => {
  it('derives the same seed from the same identity', () => {
    expect(deriveWobbleSeed('shape-1')).toBe(deriveWobbleSeed('shape-1'));
  });

  it('derives a different seed for a different shape, so two boxes do not look stamped', () => {
    expect(deriveWobbleSeed('shape-1')).not.toBe(deriveWobbleSeed('shape-2'));
  });

  it('stays a positive integer an LCG can seed', () => {
    const seed = deriveWobbleSeed('shape-1');

    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 31);
  });
});

describe('the wobble of a clean path', () => {
  it('traces the same path the same way every time it is asked', () => {
    const box = 'M 0 0 L 100 0 L 100 60 L 0 60 Z';

    expect(wobblePath(box, deriveWobbleSeed('a'), 2)).toBe(
      wobblePath(box, deriveWobbleSeed('a'), 2)
    );
  });

  it('traces two shapes with different seeds differently', () => {
    const box = 'M 0 0 L 100 0 L 100 60 L 0 60 Z';

    expect(wobblePath(box, deriveWobbleSeed('a'), 2)).not.toBe(
      wobblePath(box, deriveWobbleSeed('b'), 2)
    );
  });

  it('traces an open line as readily as a closed box', () => {
    const line = wobblePath('M 0 0 L 100 40', deriveWobbleSeed('line'), 2);

    expect(line).not.toBeNull();
    expect(line?.length).toBeGreaterThan(0);
  });

  it('refuses a command it cannot trace rather than drawing a wrong line', () => {
    expect(() =>
      wobblePath('M 0 0 A 5 5 0 0 1 10 10', deriveWobbleSeed('arc'), 2)
    ).toThrow();
  });
});

describe('the overlay inside the paint walker', () => {
  it.each([...FIGURE_KINDS])('%s carries the hand-drawn overlay', (kind) => {
    const paint = paintShape(figure(kind), light);
    const drawn = overlays(paint);

    expect(drawn.length).toBeGreaterThan(0);
    for (const path of drawn) {
      expect(path.d.length).toBeGreaterThan(0);
      expect(path.fill).toBeDefined();
      expect(path.fill).not.toBe('none');
    }
  });

  it('carries the overlay for a frame, so a box a person drew reads as drawn', () => {
    expect(overlays(paintShape(frame(), light))).not.toHaveLength(0);
  });

  it('covers the shape, so the hand-drawn line is drawn where the shape is', () => {
    const shape = figure('rectangle', { h: 60, w: 100, x: 10, y: 20 });
    const [overlay] = overlays(paintShape(shape, light));

    expect(overlay).toBeDefined();
    const points = coordinates(overlay?.d ?? '');
    expect(points.length).toBeGreaterThan(3);

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    expect(Math.min(...xs)).toBeLessThan(30);
    expect(Math.max(...xs)).toBeGreaterThan(90);
    expect(Math.min(...ys)).toBeLessThan(35);
    expect(Math.max(...ys)).toBeGreaterThan(65);
  });

  it('draws the same shape the same way, so an export can be reproduced', () => {
    const shapes = [
      figure('rectangle', { id: 'a' }),
      figure('ellipse', { id: 'b', x: 200 }),
    ];

    expect(paintBoard(board(shapes), light)).toEqual(
      paintBoard(board(shapes), light)
    );
    expect(projectBoard(board(shapes), light)).toBe(
      projectBoard(board(shapes), light)
    );
  });

  it('draws two identically shaped figures differently, because each is seeded by its own id', () => {
    const [first] = overlays(
      paintShape(figure('rectangle', { id: 'a' }), light)
    );
    const [second] = overlays(
      paintShape(figure('rectangle', { id: 'b' }), light)
    );

    expect(first?.d).not.toBe(second?.d);
  });

  it('keeps the overlay in the artifact by default, on the board the user saw', () => {
    const svg = projectBoard(board([figure('rectangle')]), light);

    expect(svg).toContain('data-wobble="true"');
  });

  it('leaves the clean geometry in place beneath the overlay', () => {
    const paint = paintShape(figure('rectangle', { h: 60, w: 100 }), light);

    expect(paint.paths[0]?.d).toBe('M 0 0 L 100 0 L 100 60 L 0 60 Z');
  });
});
