import { type FigureShape, paintShape } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const rectangle = (overrides: Partial<FigureShape> = {}): FigureShape => ({
  h: 80,
  id: 'shape-1',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: { fill: 'blue', fillStyle: 'pastel', stroke: 'ink', strokeWidth: 2 },
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
