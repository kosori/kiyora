import { SHAPES } from '@kiyora/dsl';
import {
  type FigureKind,
  type FigureShape,
  figureKindSchema,
  type Paint,
  type PaintPath,
  paintShape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const rectangle = (overrides: Partial<FigureShape> = {}): FigureShape => ({
  h: 80,
  id: 'shape-1',
  kind: 'rectangle',
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

const corners = (d: string): [number, number][] =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);

const distance = (from: [number, number], to: [number, number]): number =>
  Math.hypot(to[0] - from[0], to[1] - from[1]);

describe('painting a rectangle', () => {
  it('traces the box it was authored with, in the palette colours', () => {
    const paint = paintShape(rectangle(), { theme: 'light' });

    expect(paint.paths[0]).toEqual({
      d: 'M 0 0 L 120 0 L 120 80 L 0 80 Z',
      fill: 'rgba(25, 113, 194, 0.2)',
      stroke: '#1e1e1e',
      strokeWidth: 2,
    });
  });

  it('keeps the shape where it was placed', () => {
    const paint = paintShape(rectangle({ x: 10, y: 20 }), { theme: 'light' });

    expect(paint.paths[0]?.d).toBe('M 10 20 L 130 20 L 130 100 L 10 100 Z');
  });

  it('turns a quarter turn about its own centre', () => {
    const paint = paintShape(
      rectangle({ h: 80, rotation: 90, w: 120, x: 0, y: 0 }),
      { theme: 'light' }
    );

    expect(paint.paths[0]?.d).toBe('M 100 -20 L 100 100 L 20 100 L 20 -20 Z');
  });

  it('moves the same four corners for any angle', () => {
    const turned = corners(
      paintShape(rectangle({ rotation: 37 }), { theme: 'light' }).paths[0]?.d ??
        ''
    );

    const sides = turned.map((corner, index) =>
      distance(corner, turned[(index + 1) % turned.length] ?? corner)
    );
    expect(sides[0]).toBeCloseTo(120, 2);
    expect(sides[1]).toBeCloseTo(80, 2);
    expect(sides[2]).toBeCloseTo(120, 2);
    expect(sides[3]).toBeCloseTo(80, 2);
  });
});

const KINDS = [...figureKindSchema.options];

const figure = (kind: FigureKind): FigureShape => ({
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
    fillStyle: 'bold',
    stroke: 'ink',
    strokeWidth: 2,
  },
  w: 120,
  x: 0,
  y: 0,
});

const inks = (paint: Paint): PaintPath[] => [
  ...paint.paths,
  ...paint.children.flatMap(inks),
];

const coordinates = (d: string): [number, number][] => {
  const values = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const points: [number, number][] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    points.push([values[index] ?? 0, values[index + 1] ?? 0]);
  }
  return points;
};

const extentOf = (paint: Paint): { h: number; w: number } => {
  const points = inks(paint).flatMap((path) => coordinates(path.d));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    h: Math.max(...ys) - Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
  };
};

describe('the figure vocabulary', () => {
  it('offers every grammar shape, less the ones a shape kind owns the semantics of', () => {
    const ownedByAKind = ['sticky'];
    const known = new Set<string>(KINDS);

    for (const shape of SHAPES) {
      expect(
        known.has(shape) || ownedByAKind.includes(shape),
        `the grammar names ${shape}, and nothing on the board draws it`
      ).toBe(true);
    }

    for (const kind of KINDS) {
      expect(SHAPES).toContain(kind);
    }
  });

  it.each(KINDS)(
    '%s paints a visible fill or stroke, sized to its box',
    (kind) => {
      const paint = paintShape(figure(kind), { theme: 'light' });
      const drawn = inks(paint);

      const visible = drawn.some(
        (path) =>
          (path.fill !== undefined && path.fill !== 'none') ||
          (path.stroke !== undefined && path.stroke !== 'none')
      );
      expect(visible).toBe(true);
      expect(drawn.some((path) => path.stroke === '#1e1e1e')).toBe(true);

      const extent = extentOf(paint);
      expect(extent.w).toBeGreaterThan(0);
      expect(extent.h).toBeGreaterThan(0);
      expect(Math.max(extent.w / 120, extent.h / 80)).toBeGreaterThan(0.5);
    }
  );
});
