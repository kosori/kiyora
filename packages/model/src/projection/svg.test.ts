import {
  type Board,
  boardViewBox,
  parseBoard,
  projectBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (style: Record<string, unknown>): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [
      {
        h: 60,
        id: 'shape-1',
        kind: 'rectangle',
        locked: false,
        opacity: 1,
        parentId: null,
        rotation: 0,
        style,
        w: 100,
        x: 0,
        y: 0,
      },
    ],
    title: 'Untitled',
    updatedAt: 1_700_000_000_000,
  });

const base = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
};

describe('projecting a stroke pattern', () => {
  it('writes the dash pattern an artifact draws, so an export matches the canvas', () => {
    const svg = projectBoard(board({ ...base, dash: 'dashed' }), {
      theme: 'light',
    });

    expect(svg).toContain('stroke-dasharray="8 6"');
  });

  it('leaves a solid stroke without a dash pattern', () => {
    const svg = projectBoard(board(base), { theme: 'light' });

    expect(svg).not.toContain('stroke-dasharray');
  });
});

describe('the view a viewer fits a board into', () => {
  it('surrounds the content bounds with room on every side', () => {
    const [x = 0, y = 0, w = 0, h = 0] = boardViewBox(board(base))
      .split(' ')
      .map(Number);

    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    expect(w).toBeGreaterThan(100);
    expect(h).toBeGreaterThan(60);
    expect(w - 100).toBeGreaterThanOrEqual(64);
  });

  it('gives an empty board a frame to look at', () => {
    const empty = parseBoard({
      ...board(base),
      shapes: [],
    });

    expect(boardViewBox(empty)).toBe('0 0 1000 700');
  });
});
