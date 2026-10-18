import {
  type Board,
  type PaintContext,
  paintBoard,
  parseBoard,
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
  style: { fill: 'green', fillStyle: 'bold', stroke: 'green', strokeWidth: 2 },
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
    schemaVersion: 1,
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
});
