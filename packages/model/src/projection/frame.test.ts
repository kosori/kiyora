import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Board,
  type PaintContext,
  parseBoard,
  projectBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

const golden = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./goldens/${name}`, import.meta.url)),
    'utf8'
  );

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

const frame = (overrides: Record<string, unknown> = {}) => ({
  ...shape({
    id: 'frame-1',
    style: { fill: 'blue', fillStyle: 'pastel', stroke: 'ink', strokeWidth: 2 },
  }),
  clip: true,
  kind: 'frame',
  variant: 'plain',
  ...overrides,
});

const member = (overrides: Record<string, unknown> = {}) =>
  shape({ id: 'member-1', parentId: 'frame-1', x: 20, y: 20, ...overrides });

const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-frame',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'One frame',
    updatedAt: 1_700_000_000_000,
  });

describe('projecting a frame', () => {
  it('holds the frame’s members inside the box it was authored with', () => {
    const svg = projectBoard(
      board([frame({ h: 200, w: 300 }), member()]),
      light
    );

    expect(svg).toBe(golden('frame.svg'));
  });

  it('draws no clip at all for a frame that does not clip', () => {
    const svg = projectBoard(
      board([frame({ clip: false, h: 200, w: 300 }), member()]),
      light
    );

    expect(svg).not.toContain('clip');
  });
});
