import {
  type Board,
  boardBounds,
  type PaintContext,
  parseBoard,
  projectBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

type ShapeOverrides = Partial<{
  h: number;
  id: string;
  rotation: number;
  w: number;
  x: number;
  y: number;
}>;

const rectangle = (overrides: ShapeOverrides = {}) => ({
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

describe("the board's extent", () => {
  it('is the box that holds every shape, however far apart they sit', () => {
    const extent = boardBounds(
      board([
        rectangle({ h: 60, id: 'left', w: 100, x: 0, y: 0 }),
        rectangle({ h: 50, id: 'right', w: 50, x: 200, y: 40 }),
      ])
    );

    expect(extent).toEqual({ h: 90, w: 250, x: 0, y: 0 });
  });

  it('grows past the authored box when a shape is turned off its axis', () => {
    const extent = boardBounds(
      board([rectangle({ h: 100, rotation: 45, w: 100, x: 0, y: 0 })])
    );

    const reach = 100 * Math.SQRT2;

    expect(extent?.x).toBeCloseTo(50 - reach / 2, 3);
    expect(extent?.y).toBeCloseTo(50 - reach / 2, 3);
    expect(extent?.w).toBeCloseTo(reach, 3);
    expect(extent?.h).toBeCloseTo(reach, 3);
  });

  it('is nothing at all for a board with no shapes', () => {
    expect(boardBounds(board([]))).toBeNull();
  });

  it('is the extent the artifact is cropped to, so the exporter and the camera cannot disagree', () => {
    const drawn = board([
      rectangle({ h: 60, id: 'left', w: 100, x: 0, y: 0 }),
      rectangle({ h: 50, id: 'right', w: 50, x: 200, y: 40 }),
    ]);

    expect(projectBoard(drawn, light)).toContain('viewBox="0 0 250 90"');
    expect(boardBounds(drawn)).toEqual({ h: 90, w: 250, x: 0, y: 0 });
  });
});
