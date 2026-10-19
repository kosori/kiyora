import { type Board, parseBoard, projectBoard } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (style: Record<string, unknown>): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: 1,
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
