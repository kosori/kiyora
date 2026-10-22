import {
  type Board,
  type PaintContext,
  paintBoard,
  parseBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

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
  ...shape(),
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
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Untitled',
    updatedAt: 1_700_000_000_000,
  });

describe('painting a frame', () => {
  it('paints its own box, so a frame is a shape a person can see', () => {
    const paint = paintBoard(
      board([frame({ h: 400, id: 'frame-1', w: 600, x: 40, y: 60 })]),
      light
    );

    expect(paint.children[0]?.paths[0]).toEqual({
      d: 'M 40 60 L 640 60 L 640 460 L 40 460 Z',
      fill: '#2f9e44',
      stroke: '#2f9e44',
      strokeWidth: 2,
    });
  });

  it('holds its members inside its own node, so the frame can clip them', () => {
    const paint = paintBoard(
      board([frame({ id: 'frame-1' }), member({ x: 20, y: 20 })]),
      light
    );

    expect(paint.children.map((child) => child.shapeId)).toEqual(['frame-1']);
    expect(paint.children[0]?.children.map((child) => child.shapeId)).toEqual([
      'member-1',
    ]);
  });

  it('leaves a shape outside the frame at the top level, in paint order', () => {
    const paint = paintBoard(
      board([
        frame({ id: 'frame-1' }),
        member(),
        shape({ id: 'outside', x: 300 }),
      ]),
      light
    );

    expect(paint.children.map((child) => child.shapeId)).toEqual([
      'frame-1',
      'outside',
    ]);
  });

  it('paints a member whose frame is gone rather than losing it', () => {
    const paint = paintBoard(board([member({ x: 20, y: 20 })]), light);

    expect(paint.children.map((child) => child.shapeId)).toEqual(['member-1']);
  });

  it('carries the box its members are clipped to, when it clips', () => {
    const clipping = paintBoard(
      board([frame({ h: 400, id: 'frame-1', w: 600, x: 40, y: 60 })]),
      light
    );

    expect(clipping.children[0]?.clip).toBe(
      'M 40 60 L 640 60 L 640 460 L 40 460 Z'
    );
  });

  it('carries no clip box when the frame does not clip', () => {
    const open = paintBoard(
      board([frame({ clip: false, id: 'frame-1' })]),
      light
    );

    expect(open.children[0]?.clip).toBeUndefined();
  });
});
