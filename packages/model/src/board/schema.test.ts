import { FRAMES } from '@kiyora/dsl';
import {
  type Board,
  BoardRejection,
  boardIssues,
  parseBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const shape = (overrides: Record<string, unknown> = {}) => ({
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

/** A frame: the same base as any shape, plus a variant and whether it clips. */
const frameShape = (overrides: Record<string, unknown> = {}) => ({
  ...shape(),
  clip: true,
  kind: 'frame',
  variant: 'plain',
  ...overrides,
});

const board = (overrides: Record<string, unknown> = {}) => ({
  camera: { x: 0, y: 0, zoom: 1 },
  createdAt: 1_700_000_000_000,
  deck: [],
  id: 'board-1',
  schemaVersion: SCHEMA_VERSION,
  settings: { theme: 'light' },
  shapes: [shape()],
  title: 'Untitled',
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

describe('the board', () => {
  it('reads a board as the authored state it carries', () => {
    const parsed: Board = parseBoard(board());

    expect(parsed.shapes[0]?.style).toEqual({
      corner: 'sharp',
      dash: 'solid',
      fill: 'blue',
      fillStyle: 'pastel',
      stroke: 'ink',
      strokeWidth: 2,
    });
    expect(parsed.deck).toEqual([]);
    expect(parsed.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('keeps a shape authored with text, and one authored without', () => {
    const parsed = parseBoard(
      board({
        shapes: [
          shape({ id: 'with-text', text: 'Ship it' }),
          shape({ id: 'bare' }),
        ],
      })
    );

    expect(parsed.shapes.map((one) => one.text)).toEqual([
      'Ship it',
      undefined,
    ]);
  });

  it('keeps the corners and the dash a shape was authored with', () => {
    const parsed = parseBoard(
      board({
        shapes: [
          shape({
            id: 'round-dashed',
            style: {
              corner: 'rounded',
              dash: 'dashed',
              fill: 'blue',
              fillStyle: 'pastel',
              stroke: 'ink',
              strokeWidth: 2,
            },
          }),
        ],
      })
    );

    expect(parsed.shapes[0]?.style).toMatchObject({
      corner: 'rounded',
      dash: 'dashed',
    });
  });

  it('rejects a corner the grammar does not name, rather than guessing one', () => {
    const issues = boardIssues(
      board({
        shapes: [shape({ style: { ...shape().style, corner: 'bevel' } })],
      })
    );

    expect(issues.map((issue) => issue.path)).toEqual([
      'shapes.0.style.corner',
    ]);
  });

  it('rejects a dash outside the stroke patterns on offer', () => {
    const issues = boardIssues(
      board({ shapes: [shape({ style: { ...shape().style, dash: 'wavy' } })] })
    );

    expect(issues.map((issue) => issue.path)).toEqual(['shapes.0.style.dash']);
  });

  it('keeps a deck entry: the frame it presents, its notes, and whether it is skipped', () => {
    const parsed = parseBoard(
      board({
        deck: [{ frameId: 'frame-1', notes: 'Welcome', skipped: true }],
      })
    );

    expect(parsed.deck).toEqual([
      { frameId: 'frame-1', notes: 'Welcome', skipped: true },
    ]);
  });

  it('stores nothing derived: an ordering number and a computed box are dropped', () => {
    const parsed = parseBoard(
      board({
        shapes: [{ ...shape(), bounds: { h: 80, w: 120, x: 0, y: 0 }, z: 4 }],
      })
    );

    expect(parsed.shapes[0]).toEqual(shape());
  });
});

describe('a frame', () => {
  it('is a shape that keeps the box it was authored with, its variant and whether it clips', () => {
    const authored = frameShape({ h: 400, w: 600, x: 40, y: 60 });

    expect(parseBoard(board({ shapes: [authored] })).shapes[0]).toEqual(
      authored
    );
  });

  it('accepts every variant the grammar names, so the model keeps no second list', () => {
    const issues = boardIssues(
      board({
        shapes: FRAMES.map((variant, index) =>
          frameShape({ id: `frame-${index}`, variant })
        ),
      })
    );

    expect(issues).toEqual([]);
  });

  it('rejects a variant the grammar does not name', () => {
    const issues = boardIssues(
      board({ shapes: [frameShape({ variant: 'paper' })] })
    );

    expect(issues.map((issue) => issue.path)).toEqual(['shapes.0.variant']);
  });
});

describe('rejecting a board', () => {
  it('accepts a board with no issues', () => {
    expect(boardIssues(board())).toEqual([]);
  });

  it('names the field that failed', () => {
    const issues = boardIssues(
      board({ shapes: [shape({ opacity: 1.5 }), shape({ id: 'shape-2' })] })
    );

    expect(issues.map((issue) => issue.path)).toEqual(['shapes.0.opacity']);
    expect(issues[0]?.message).toMatch(/1/);
  });

  it('names the kind when the vocabulary does not know it', () => {
    const issues = boardIssues(
      board({ shapes: [shape({ kind: 'squiggle' })] })
    );

    expect(issues.map((issue) => issue.path)).toEqual(['shapes.0.kind']);
  });

  it('accepts every figure the grammar names, not just a rectangle', () => {
    const issues = boardIssues(
      board({
        shapes: [shape({ kind: 'hexagon' }), shape({ id: 'b', kind: 'cloud' })],
      })
    );

    expect(issues).toEqual([]);
  });

  it('names every missing part of a board', () => {
    const issues = boardIssues({ id: 'board-1' });

    expect(issues.map((issue) => issue.path).sort()).toEqual([
      'camera',
      'createdAt',
      'deck',
      'schemaVersion',
      'settings',
      'shapes',
      'title',
      'updatedAt',
    ]);
  });

  it('names the board itself when the input is not an object', () => {
    expect(boardIssues('not a board').map((issue) => issue.path)).toEqual([
      'board',
    ]);
  });

  it('rejects a shape stamped with a version this code does not know', () => {
    const issues = boardIssues(board({ schemaVersion: SCHEMA_VERSION + 1 }));

    expect(issues.map((issue) => issue.path)).toEqual(['schemaVersion']);
  });

  it('throws a rejection whose message names what failed', () => {
    const invalid = board({
      shapes: [shape({ style: { fillStyle: 'plaid' } })],
    });

    expect(() => parseBoard(invalid)).toThrow(BoardRejection);
    expect(() => parseBoard(invalid)).toThrow(/shapes\.0\.style\.fillStyle/);
  });
});
