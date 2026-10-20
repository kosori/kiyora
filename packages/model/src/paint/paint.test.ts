import {
  type Board,
  type PaintContext,
  paintBoard,
  parseBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

const drawn = (board: Board): (string | undefined)[] =>
  paintBoard(board, light).children.map((child) => child.paths[0]?.d);

const shape = (overrides: Record<string, unknown> = {}) => ({
  h: 60,
  id: 'shape-1',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'green',
    fillStyle: 'bold',
    stroke: 'green',
    strokeWidth: 2,
  },
  w: 100,
  x: 0,
  y: 0,
  ...overrides,
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

describe('painting a board', () => {
  it('paints the shapes in the order they are stored, and repaints them in a new order', () => {
    const first = shape({ id: 'first', x: 0 });
    const second = shape({ id: 'second', x: 200 });
    const firstBox = 'M 0 0 L 100 0 L 100 60 L 0 60 Z';
    const secondBox = 'M 200 0 L 300 0 L 300 60 L 200 60 Z';

    expect(drawn(board([first, second]))).toEqual([firstBox, secondBox]);
    expect(drawn(board([second, first]))).toEqual([secondBox, firstBox]);
  });

  it('paints an empty board to nothing', () => {
    expect(paintBoard(board([]), light)).toEqual({ children: [], paths: [] });
  });

  it('draws a shape with no fill style without filling it', () => {
    const paint = paintBoard(
      board([
        shape({
          style: {
            corner: 'sharp',
            dash: 'solid',
            fill: 'red',
            fillStyle: 'outline',
            stroke: 'red',
            strokeWidth: 1,
          },
        }),
      ]),
      light
    );

    expect(paint.children[0]?.paths[0]?.fill).toBe('none');
    expect(paint.children[0]?.paths[0]?.stroke).toBe('#e03131');
  });

  it('folds the shape opacity into the fill and the stroke', () => {
    const paint = paintBoard(board([shape({ opacity: 0.5 })]), light);

    expect(paint.children[0]?.paths[0]).toEqual({
      d: 'M 0 0 L 100 0 L 100 60 L 0 60 Z',
      fill: 'rgba(47, 158, 68, 0.5)',
      stroke: 'rgba(47, 158, 68, 0.5)',
      strokeWidth: 2,
    });
  });

  it('paints on the canvas the context names, not the one the board remembers', () => {
    const onLight = paintBoard(board([shape()]), { theme: 'light' });
    const onDark = paintBoard(board([shape()]), { theme: 'dark' });

    expect(onLight.children[0]?.paths[0]?.fill).toBe('#2f9e44');
    expect(onDark.children[0]?.paths[0]?.fill).toBe('#8ce99a');
  });

  it('breaks a dashed or dotted stroke into its pattern, and leaves a solid one unbroken', () => {
    const dashed = paintBoard(
      board([shape({ style: { ...shape().style, dash: 'dashed' } })]),
      light
    );
    const dotted = paintBoard(
      board([shape({ style: { ...shape().style, dash: 'dotted' } })]),
      light
    );
    const solid = paintBoard(board([shape()]), light);

    expect(dashed.children[0]?.paths[0]?.dash).toEqual([8, 6]);
    expect(dotted.children[0]?.paths[0]?.dash).toEqual([2, 6]);
    expect(solid.children[0]?.paths[0]?.dash).toBeUndefined();
  });

  it('rounds a rectangle\u2019s corners when its style asks, and squares them otherwise', () => {
    const rounded = paintBoard(
      board([shape({ style: { ...shape().style, corner: 'rounded' } })]),
      light
    ).children[0]?.paths[0]?.d;

    expect(rounded).not.toBe('M 0 0 L 100 0 L 100 60 L 0 60 Z');
    expect(rounded).toContain('C');
    expect(rounded?.startsWith('M 9.6 0')).toBe(true);
  });
});

describe('naming the shape a paint came from', () => {
  it('names each painted node after its shape, in paint order', () => {
    const paint = paintBoard(
      board([shape({ id: 'first', x: 0 }), shape({ id: 'second', x: 200 })]),
      light
    );

    expect(paint.children.map((child) => child.shapeId)).toEqual([
      'first',
      'second',
    ]);
  });

  it('names the same shape after the paint order changes, so a renderer follows identity', () => {
    const paint = paintBoard(
      board([shape({ id: 'second', x: 200 }), shape({ id: 'first', x: 0 })]),
      light
    );

    expect(paint.children.map((child) => child.shapeId)).toEqual([
      'second',
      'first',
    ]);
  });

  it('names a painted node without losing any of its paint', () => {
    const paint = paintBoard(board([shape({ id: 'lone' })]), light);

    expect(paint.children[0]?.shapeId).toBe('lone');
    expect(paint.children[0]?.paths[0]?.d).toBe(
      'M 0 0 L 100 0 L 100 60 L 0 60 Z'
    );
  });

  it('leaves the board node unnamed, because it came from no shape', () => {
    expect(paintBoard(board([shape()]), light).shapeId).toBeUndefined();
  });
});

describe('painting a group', () => {
  const group = (overrides: Record<string, unknown> = {}) =>
    shape({ kind: 'group', ...overrides });

  it('paints no ink of its own, because a group has no box a person drew', () => {
    const paint = paintBoard(board([group({ id: 'group-1' })]), light);

    expect(paint.children[0]?.paths).toEqual([]);
  });

  it('holds its members inside its node, so they paint through the nesting', () => {
    const paint = paintBoard(
      board([
        group({ id: 'group-1' }),
        shape({ id: 'member-1', parentId: 'group-1', x: 20, y: 30 }),
      ]),
      light
    );

    expect(paint.children.map((child) => child.shapeId)).toEqual(['group-1']);
    expect(paint.children[0]?.children.map((child) => child.shapeId)).toEqual([
      'member-1',
    ]);
    expect(paint.children[0]?.children[0]?.paths[0]?.d).toBe(
      'M 20 30 L 120 30 L 120 90 L 20 90 Z'
    );
  });

  it('nests a group inside a group without painting anything on the way', () => {
    const paint = paintBoard(
      board([
        group({ id: 'outer' }),
        group({ id: 'inner', parentId: 'outer' }),
        shape({ id: 'member-1', parentId: 'inner' }),
      ]),
      light
    );

    const inner = paint.children[0]?.children[0];

    expect(inner?.paths).toEqual([]);
    expect(inner?.children.map((child) => child.shapeId)).toEqual(['member-1']);
  });
});
