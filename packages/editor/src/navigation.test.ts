import {
  createEditor,
  nextShape,
  resolveKey,
  runCommand,
  shortcutReference,
} from '@kiyora/editor';
import {
  type Board,
  type ConnectorShape,
  type FigureShape,
  type FrameShape,
  type GroupShape,
  parseBoard,
  SCHEMA_VERSION,
  type Shape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const rectangle = (
  id: string,
  x: number,
  y: number,
  w = 100,
  h = 100
): FigureShape => ({
  h,
  id,
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w,
  x,
  y,
});

const group = (id: string): GroupShape => ({
  h: 0,
  id,
  kind: 'group',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 0,
  x: 0,
  y: 0,
});

const frame = (id: string, x: number, y: number): FrameShape => ({
  clip: true,
  h: 300,
  id,
  kind: 'frame',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  variant: 'browser',
  w: 300,
  x,
  y,
});

const connector = (id: string, from: number, to: number): ConnectorShape => ({
  end: 'none',
  from: { kind: 'free', x: from, y: 50 },
  h: 1,
  id,
  kind: 'connector',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  route: 'straight',
  start: 'none',
  style,
  to: { kind: 'free', x: to, y: 50 },
  w: 1,
  x: 0,
  y: 0,
});

const board = (shapes: Shape[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Board',
    updatedAt: 1_700_000_000_000,
  });

/** The id a step lands on, or `null` when nothing lies that way. */
const step = (
  shapes: Shape[],
  selection: readonly string[],
  direction: 'down' | 'left' | 'right' | 'up'
): string | null => nextShape(board(shapes), selection, direction)?.id ?? null;

const origin = rectangle('origin', 0, 0);

describe('stepping the selection spatially', () => {
  it('moves to the shape that lies in the arrow’s half-plane, not the next one painted', () => {
    const shapes = [
      origin,
      rectangle('far', 600, 0),
      rectangle('near', 300, 0),
    ];

    expect(step(shapes, ['origin'], 'right')).toBe('near');
    expect(step(shapes, ['near'], 'right')).toBe('far');
    expect(step(shapes, ['far'], 'left')).toBe('near');
  });

  it('prefers a shape on the selection’s own line over one that is nearer but off it', () => {
    const shapes = [
      origin,
      rectangle('off-line', 200, 180),
      rectangle('on-line', 400, 0),
    ];

    expect(step(shapes, ['origin'], 'right')).toBe('on-line');
  });

  it('picks the nearer of two shapes on the same line', () => {
    const shapes = [
      origin,
      rectangle('further', 500, 0),
      rectangle('nearer', 250, 0),
    ];

    expect(step(shapes, ['origin'], 'right')).toBe('nearer');
  });

  it('breaks a tie by paint order, so two equally near shapes always resolve the same way', () => {
    const above = rectangle('above', 200, -80);
    const below = rectangle('below', 200, 80);
    const shapes = [origin, above, below];

    expect(step(shapes, ['origin'], 'right')).toBe('above');
    expect(step([origin, below, above], ['origin'], 'right')).toBe('below');
  });

  it('does nothing when nothing lies that way, rather than wrapping to the other edge', () => {
    const shapes = [origin, rectangle('left', -300, 0)];

    expect(step(shapes, ['origin'], 'right')).toBeNull();
    expect(step(shapes, ['left'], 'left')).toBeNull();
  });

  it('steps from a multi-selection’s own box, and never onto a shape it already holds', () => {
    const shapes = [
      origin,
      rectangle('middle', 300, 0),
      rectangle('end', 700, 0),
    ];

    expect(step(shapes, ['origin', 'middle'], 'right')).toBe('end');
  });

  it('treats a group as the box its members derive, and not its stored placeholder', () => {
    const holder = group('group');
    const shapes: Shape[] = [
      origin,
      holder,
      { ...rectangle('member', 400, 0), parentId: 'group' },
    ];

    expect(step(shapes, ['origin'], 'right')).toBe('group');
  });

  it('leaves a selected frame rather than stepping into what it holds', () => {
    const shapes: Shape[] = [
      origin,
      frame('frame', 200, 0),
      { ...rectangle('inside', 250, 50), parentId: 'frame' },
      rectangle('beyond', 700, 0),
    ];

    expect(step(shapes, ['frame'], 'right')).toBe('beyond');
  });

  it('reaches a connector by the path its ends resolve, not its stored footprint', () => {
    const shapes = [origin, connector('line', 400, 600)];

    expect(step(shapes, ['origin'], 'right')).toBe('line');
  });

  it('has nowhere to step from with nothing selected', () => {
    expect(step([origin, rectangle('next', 300, 0)], [], 'right')).toBeNull();
  });
});

describe('the navigation mode', () => {
  const twoShapes = (): Shape[] => [origin, rectangle('next', 300, 0)];

  it('enters from the canvas, steps with the arrow, and leaves on Escape', () => {
    const editor = createEditor(board(twoShapes()));
    editor.setSelection(['origin']);

    runCommand({ kind: 'navigate-enter' }, { editor });
    expect(editor.getView().navigating).toBe(true);

    runCommand({ direction: 'right', kind: 'navigate-move' }, { editor });
    expect(editor.getSelection()).toEqual(['next']);

    runCommand({ kind: 'navigate-exit' }, { editor });
    expect(editor.getView().navigating).toBe(false);
    expect(editor.getSelection()).toEqual(['next']);
  });

  it('writes nothing: the board, its history and its save are untouched by a step', () => {
    const editor = createEditor(board(twoShapes()));
    const before = editor.getBoard();
    editor.setSelection(['origin']);

    runCommand({ kind: 'navigate-enter' }, { editor });
    runCommand({ direction: 'right', kind: 'navigate-move' }, { editor });
    runCommand({ kind: 'navigate-exit' }, { editor });

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('keeps the arrows nudging in the edit mode, so a key means one thing at a time', () => {
    expect(resolveKey({ key: 'ArrowRight' })).toEqual({
      coarse: false,
      dx: 1,
      dy: 0,
      kind: 'nudge',
    });
    expect(resolveKey({ key: 'ArrowRight', mode: 'navigate' })).toEqual({
      direction: 'right',
      kind: 'navigate-move',
    });
    expect(resolveKey({ key: 'Escape' })).toEqual({ kind: 'cancel-gesture' });
    expect(resolveKey({ key: 'Escape', mode: 'navigate' })).toEqual({
      kind: 'navigate-exit',
    });
    expect(resolveKey({ key: 'Enter' })).toEqual({ kind: 'navigate-enter' });
  });

  it('has a reference row for entering, each step and leaving, so the sheet cannot drift', () => {
    const rows = shortcutReference('other');

    expect(
      rows.find((row) => row.label === 'Enter shape navigation')?.keys
    ).toEqual(['Enter']);
    expect(rows.find((row) => row.label === 'Move right')?.keys).toEqual(['→']);
    expect(
      rows.find((row) => row.label === 'Leave shape navigation')?.keys
    ).toEqual(['Esc']);
  });
});
