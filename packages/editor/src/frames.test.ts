import {
  createEditor,
  DEFAULT_FRAME_SIZE,
  frameAround,
  frameIds,
  memberIds,
  setMembership,
  subtreeIds,
} from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

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

const board = (shapes: unknown[]): Board =>
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

const ids = (one: Board): string[] => one.shapes.map((entry) => entry.id);

describe('recording membership', () => {
  it('puts a shape into a frame and places it right behind that frame', () => {
    const before = board([
      frame({ h: 400, id: 'frame-1', w: 600 }),
      shape({ id: 'outside', x: 900 }),
    ]);

    const after = setMembership(before, 'outside', 'frame-1');

    expect(ids(after)).toEqual(['frame-1', 'outside']);
    expect(after.shapes[1]?.parentId).toBe('frame-1');
  });

  it('reorders a frame’s members with the same operation, at the same index', () => {
    const before = board([
      frame({ id: 'frame-1' }),
      shape({ id: 'a', parentId: 'frame-1' }),
      shape({ id: 'b', parentId: 'frame-1' }),
      shape({ id: 'c', parentId: 'frame-1' }),
    ]);

    const after = setMembership(before, 'c', 'frame-1', 0);

    expect(ids(after)).toEqual(['frame-1', 'c', 'a', 'b']);
    expect(memberIds(after, 'frame-1')).toEqual(['c', 'a', 'b']);
  });

  it('releases a member back to the top level, painted last', () => {
    const before = board([
      frame({ id: 'frame-1' }),
      shape({ id: 'a', parentId: 'frame-1' }),
      shape({ id: 'b', parentId: 'frame-1' }),
    ]);

    const after = setMembership(before, 'a', null);

    expect(ids(after)).toEqual(['frame-1', 'b', 'a']);
    expect(after.shapes[2]?.parentId).toBeNull();
  });

  it('never rewrites the frame it moves a shape into, however big the shape is', () => {
    const authored = frame({ h: 100, id: 'frame-1', w: 100, x: 0, y: 0 });
    const before = board([authored, shape({ h: 500, id: 'huge', w: 900 })]);

    const after = setMembership(before, 'huge', 'frame-1');

    expect(after.shapes[0]).toEqual(authored);
  });

  it('refuses a parent that is not a frame, leaving the board as it was', () => {
    const before = board([
      shape({ id: 'plain-1' }),
      shape({ id: 'a', x: 400 }),
    ]);

    expect(setMembership(before, 'a', 'plain-1')).toBe(before);
  });

  it('refuses a shape the board does not hold', () => {
    const before = board([frame({ id: 'frame-1' })]);

    expect(setMembership(before, 'ghost', 'frame-1')).toBe(before);
  });
});

describe('reading a frame', () => {
  it('lists a frame’s members in paint order', () => {
    const one = board([
      frame({ id: 'frame-1' }),
      shape({ id: 'a', parentId: 'frame-1' }),
      shape({ id: 'b', parentId: 'frame-1' }),
      shape({ id: 'outside' }),
    ]);

    expect(memberIds(one, 'frame-1')).toEqual(['a', 'b']);
  });

  it('enumerates the frames in paint order, so a deck has an order to keep', () => {
    const one = board([
      frame({ id: 'first' }),
      shape({ id: 'a', parentId: 'first' }),
      frame({ id: 'second', x: 600 }),
    ]);

    expect(frameIds(one)).toEqual(['first', 'second']);
  });

  it('carries a frame’s members, and a member’s own members, with it', () => {
    const one = board([
      frame({ id: 'outer' }),
      frame({ id: 'inner', parentId: 'outer' }),
      shape({ id: 'deep', parentId: 'inner' }),
      shape({ id: 'outside' }),
    ]);

    expect(subtreeIds(one, ['outer'])).toEqual(['outer', 'inner', 'deep']);
    expect(subtreeIds(one, ['outside'])).toEqual(['outside']);
  });

  it('finds the topmost frame whose box holds a box, and nothing when none does', () => {
    const behind = frame({ h: 400, id: 'behind', w: 600 });
    const front = frame({ h: 200, id: 'front', w: 300 });
    const one = board([behind, front]);
    const inside = { h: 60, w: 100, x: 20, y: 20 };

    expect(frameAround(one, inside)?.id).toBe('front');
    expect(frameAround(one, { h: 10, w: 10, x: 900, y: 900 })).toBeNull();
    expect(frameAround(one, { h: 10, w: 10, x: 320, y: 20 })?.id).toBe(
      'behind'
    );
  });
});

describe('drawing inside a frame', () => {
  it('records a shape drawn inside a frame as its member, behind that frame', () => {
    const editor = createEditor(
      board([frame({ h: 400, id: 'frame-1', w: 600 })])
    );
    editor.setTool('rectangle');

    editor.placeShape({ from: { x: 20, y: 20 }, to: { x: 120, y: 80 } });

    const after = editor.getBoard();
    expect(ids(after)).toEqual(['frame-1', 'rectangle-1']);
    expect(after.shapes[1]?.parentId).toBe('frame-1');
  });

  it('leaves a shape drawn outside every frame on top of the board', () => {
    const editor = createEditor(
      board([frame({ h: 400, id: 'frame-1', w: 600 })])
    );
    editor.setTool('rectangle');

    editor.placeShape({ from: { x: 900, y: 900 }, to: { x: 1000, y: 960 } });

    expect(editor.getBoard().shapes[1]?.parentId).toBeNull();
  });

  it('keeps the frame’s authored box, however the member lands inside it', () => {
    const authored = frame({ h: 400, id: 'frame-1', w: 600, x: 40, y: 60 });
    const editor = createEditor(board([authored]));
    editor.setTool('rectangle');

    editor.placeShape({ from: { x: 620, y: 440 }, to: { x: 700, y: 500 } });

    expect(editor.getBoard().shapes[0]).toEqual(authored);
  });
});

describe('moving a frame', () => {
  it('carries its members when it is dragged', () => {
    const editor = createEditor(
      board([
        frame({ h: 200, id: 'frame-1', w: 300 }),
        shape({ h: 40, id: 'a', parentId: 'frame-1', w: 60, x: 20, y: 20 }),
      ])
    );
    editor.setSelection(['frame-1']);

    editor.pointerDown({ x: 250, y: 150 }, false);
    editor.pointerMove({ x: 290, y: 190 }, false);
    editor.pointerUp();

    const after = editor.getBoard();
    expect(after.shapes[0]).toMatchObject({ x: 40, y: 40 });
    expect(after.shapes[1]).toMatchObject({ x: 60, y: 60 });
  });

  it('carries its members when it is nudged', () => {
    const editor = createEditor(
      board([
        frame({ h: 200, id: 'frame-1', w: 300 }),
        shape({ h: 40, id: 'a', parentId: 'frame-1', w: 60, x: 20, y: 20 }),
      ])
    );
    editor.setSelection(['frame-1']);

    editor.nudge(8, 8);

    const after = editor.getBoard();
    expect(after.shapes[0]).toMatchObject({ x: 8, y: 8 });
    expect(after.shapes[1]).toMatchObject({ x: 28, y: 28 });
  });

  it('leaves the frame’s box alone when only a member moves', () => {
    const editor = createEditor(
      board([
        frame({ h: 200, id: 'frame-1', w: 300, x: 0, y: 0 }),
        shape({ h: 40, id: 'a', parentId: 'frame-1', w: 60, x: 20, y: 20 }),
      ])
    );
    editor.setSelection(['a']);

    editor.nudge(8, 8);

    const after = editor.getBoard();
    expect(after.shapes[0]).toMatchObject({ h: 200, w: 300, x: 0, y: 0 });
    expect(after.shapes[1]).toMatchObject({ x: 28, y: 28 });
  });
});

describe('placing a frame', () => {
  it('places a plain, clipping frame the size of the drag', () => {
    const editor = createEditor(board([]));
    editor.setTool('frame');

    editor.placeShape({ from: { x: 0, y: 0 }, to: { x: 600, y: 400 } });

    expect(editor.getBoard().shapes[0]).toEqual({
      clip: true,
      h: 400,
      id: 'frame-1',
      kind: 'frame',
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: editor.getStyle(),
      variant: 'plain',
      w: 600,
      x: 0,
      y: 0,
    });
  });

  it('places a frame a frame-sized default when the gesture never moved', () => {
    const editor = createEditor(board([]));
    editor.setTool('frame');

    editor.placeShape({ from: { x: 500, y: 400 }, to: { x: 500, y: 400 } });

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: DEFAULT_FRAME_SIZE.h,
      w: DEFAULT_FRAME_SIZE.w,
      x: 500 - DEFAULT_FRAME_SIZE.w / 2,
      y: 400 - DEFAULT_FRAME_SIZE.h / 2,
    });
  });

  it('returns to select after placing a frame, like every other tool', () => {
    const editor = createEditor(board([]));
    editor.setTool('frame');

    editor.placeShape({ from: { x: 0, y: 0 }, to: { x: 600, y: 400 } });

    expect(editor.getTool()).toBe('select');
  });

  it('draws a frame inside a frame as its member, so frames nest', () => {
    const editor = createEditor(
      board([frame({ h: 400, id: 'frame-1', w: 600 })])
    );
    editor.setTool('frame');

    editor.placeShape({ from: { x: 20, y: 20 }, to: { x: 220, y: 120 } });

    expect(ids(editor.getBoard())).toEqual(['frame-1', 'frame-2']);
    expect(editor.getBoard().shapes[1]?.parentId).toBe('frame-1');
  });
});
