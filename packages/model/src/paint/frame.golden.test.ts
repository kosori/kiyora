import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Board,
  FRAME_VARIANTS,
  type FrameVariant,
  type PaintContext,
  paintBoard,
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

const frame = (overrides: Record<string, unknown> = {}) => ({
  ...shape({
    h: 200,
    id: 'frame-1',
    style: {
      corner: 'sharp',
      dash: 'solid',
      fill: 'blue',
      fillStyle: 'pastel',
      stroke: 'ink',
      strokeWidth: 2,
    },
    w: 300,
  }),
  clip: true,
  kind: 'frame',
  variant: 'plain',
  ...overrides,
});

const member = (overrides: Record<string, unknown> = {}) =>
  shape({ id: 'member-1', parentId: 'frame-1', ...overrides });

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

const VARIANTS: readonly FrameVariant[] = FRAME_VARIANTS;

describe('painting a device frame', () => {
  for (const variant of VARIANTS) {
    it(`matches the committed ${variant} golden, so the chrome is paths and not a count`, () => {
      const svg = projectBoard(board([frame({ variant })]), light);

      expect(svg).toBe(golden(`frame-${variant}.svg`));
    });
  }

  it('keeps the authored box as the clip, so the chrome never shrinks the content', () => {
    const paint = paintBoard(
      board([frame({ variant: 'phone' }), member({ h: 60, w: 100 })]),
      light
    );
    const [node] = paint.children;

    expect(node?.clip).toBe('M 0 0 L 300 0 L 300 200 L 0 200 Z');
    expect(node?.children[0]?.paths[0]?.d).toBe(
      'M 0 0 L 100 0 L 100 60 L 0 60 Z'
    );
  });

  it('draws a member at the top-left over the chrome, not under it', () => {
    const memberPath = 'M 0 0 L 100 0 L 100 60 L 0 60 Z';
    const svg = projectBoard(
      board([frame({ variant: 'phone' }), member({ h: 60, w: 100 })]),
      light
    );

    expect(svg).toContain(`<path d="${memberPath}"`);
    expect(svg.indexOf(memberPath)).toBeGreaterThan(
      svg.indexOf('clip-path="url(#clip-frame-1)"')
    );
  });
});
