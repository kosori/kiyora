import { createEditor, GUIDE_TOLERANCE } from '@kiyora/editor';
import {
  type Board,
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

const rectangle = (overrides: Partial<FigureShape> = {}): Shape =>
  ({
    h: 100,
    id: 'rectangle-1',
    kind: 'rectangle',
    locked: false,
    opacity: 1,
    parentId: null,
    rotation: 0,
    style,
    w: 100,
    x: 0,
    y: 0,
    ...overrides,
  }) as Shape;

const group = (overrides: Partial<GroupShape> = {}): Shape =>
  ({
    h: 0,
    id: 'group-1',
    kind: 'group',
    locked: false,
    opacity: 1,
    parentId: null,
    rotation: 0,
    style,
    w: 0,
    x: 0,
    y: 0,
    ...overrides,
  }) as Shape;

const frame = (overrides: Partial<FrameShape> = {}): Shape =>
  ({
    clip: true,
    h: 100,
    id: 'frame-1',
    kind: 'frame',
    locked: false,
    opacity: 1,
    parentId: null,
    rotation: 0,
    style,
    variant: 'plain',
    w: 100,
    x: 0,
    y: 0,
    ...overrides,
  }) as Shape;

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

const none = { bypassSnap: false, constrain: false } as const;
const bypass = { bypassSnap: true, constrain: false } as const;

/** Opens a move on the shape under `from` and drags the pointer by `delta`. */
const dragBy = (
  editor: ReturnType<typeof createEditor>,
  from: { x: number; y: number },
  delta: { x: number; y: number },
  modifiers: { bypassSnap: boolean; constrain: boolean } = none
): void => {
  editor.pointerDown(from, false);
  editor.pointerMove({ x: from.x + delta.x, y: from.y + delta.y }, modifiers);
};

describe('alignment guides', () => {
  it('is three quarters of a grid step wide', () => {
    expect(GUIDE_TOLERANCE).toBe(6);
  });

  it('lands a dragged edge on another shape’s edge, ahead of the grid', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', x: 197, y: 300 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 200, y: 0 });

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 197 });
  });

  it('lands a dragged edge on another shape’s centre', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', x: 200, y: 300 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 198, y: 0 });

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 200 });
  });

  it('gives one guide per axis and the grid on the axis without one', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', x: 197, y: 300 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 200, y: 100 });

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 197, y: 104 });
  });

  it('takes a vertical guide and a horizontal one in the same drag', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', x: 197, y: 900 }),
        rectangle({ id: 'c', x: 400, y: 197 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 200, y: 200 });

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 197, y: 197 });
  });

  it('never snaps a shape to its own edges', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 0 })]));
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 5, y: 0 });

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 8 });
  });

  it('snaps to a locked shape, which still has edges', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', locked: true, x: 197, y: 300 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 200, y: 0 });

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 197 });
  });

  it('lets a frame’s authored edge guide what it holds', () => {
    const editor = createEditor(
      board([
        frame({ h: 300, id: 'f', w: 400, x: 100, y: 100 }),
        rectangle({ h: 50, id: 'a', parentId: 'f', x: 150, y: 150 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 200, y: 175 }, { x: -100, y: 0 });

    expect(editor.getBoard().shapes[1]).toMatchObject({ x: 50, y: 152 });
  });

  it('uses a group’s derived box, never its stored stand-in', () => {
    const editor = createEditor(
      board([
        group(),
        rectangle({ id: 'member', parentId: 'group-1', x: 397, y: 300 }),
        rectangle({ id: 'a', x: 0 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 400, y: 0 });

    expect(editor.getBoard().shapes[2]).toMatchObject({ x: 397 });
  });

  it('leaves both the guide and the grid when alt is held', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', x: 197, y: 300 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 201, y: 0 }, bypass);

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 201 });
  });

  it('draws the guide only while the gesture is open', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', x: 197, y: 300 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 200, y: 0 });

    const open = editor.getGesture();
    expect(open).toMatchObject({
      guides: [{ axis: 'x', value: 197 }],
      kind: 'move',
    });

    editor.pointerUp();

    expect(editor.getGesture()).toEqual({ kind: 'idle' });
  });

  it('keeps the guide out of the document', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', x: 197, y: 300 }),
      ])
    );
    editor.setSelection(['a']);

    dragBy(editor, { x: 50, y: 50 }, { x: 200, y: 0 });

    expect(JSON.stringify(editor.getBoard())).not.toContain('guides');
  });

  it('is one history entry, whatever the guides did', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0 }),
        rectangle({ id: 'b', x: 197, y: 300 }),
      ])
    );
    editor.setSelection(['a']);
    dragBy(editor, { x: 50, y: 50 }, { x: 200, y: 0 });
    editor.pointerUp();

    editor.undo();

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 0 });
  });
});

describe('alignment guides on a resize', () => {
  /** A selection box with its south-east handle at (300, 220), and a target to its right. */
  const resizing = () =>
    createEditor(
      board([
        rectangle({ h: 140, id: 'a', w: 220, x: 80, y: 80 }),
        rectangle({ id: 'b', x: 597, y: 400 }),
      ])
    );

  const grabSouthEast = (editor: ReturnType<typeof createEditor>): void => {
    editor.setSelection(['a']);
    editor.pointerDown({ x: 300, y: 220 }, false);
  };

  it('lands the dragged edge on another shape’s edge, ahead of the grid', () => {
    const editor = resizing();
    grabSouthEast(editor);

    editor.pointerMove({ x: 600, y: 224 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({ w: 517, x: 80 });
  });

  it('lands the dragged edge on another shape’s centre', () => {
    const editor = createEditor(
      board([
        rectangle({ h: 140, id: 'a', w: 220, x: 80, y: 80 }),
        rectangle({ id: 'b', x: 535, y: 400 }),
      ])
    );
    grabSouthEast(editor);

    editor.pointerMove({ x: 587, y: 224 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({ w: 505 });
  });

  it('snaps the guided axis to the guide and the other to the grid', () => {
    const editor = resizing();
    grabSouthEast(editor);

    editor.pointerMove({ x: 600, y: 224 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({ h: 144, w: 517 });
  });

  it('draws the guide while the resize is open', () => {
    const editor = resizing();
    grabSouthEast(editor);

    editor.pointerMove({ x: 600, y: 224 }, none);

    expect(editor.getGesture()).toMatchObject({
      guides: [{ axis: 'x', value: 597 }],
      handle: 'se',
      kind: 'resize',
    });
  });

  it('leaves the guide and the grid when alt is held', () => {
    const editor = resizing();
    grabSouthEast(editor);

    editor.pointerMove({ x: 600, y: 224 }, bypass);

    expect(editor.getGesture()).toMatchObject({ guides: [] });
    expect(editor.getBoard().shapes[0]).toMatchObject({ w: 820 });
  });

  it('leaves the guides alone when shift keeps the ratio', () => {
    const editor = resizing();
    grabSouthEast(editor);

    editor.pointerMove(
      { x: 600, y: 224 },
      { bypassSnap: false, constrain: true }
    );

    expect(editor.getGesture()).toMatchObject({ guides: [] });
  });

  it('keeps the pointer snap for a turned shape, which has no world edge', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', rotation: 90, x: 0, y: 0 }),
        rectangle({ id: 'b', x: 106, y: 400 }),
      ])
    );
    editor.setSelection(['a']);
    editor.pointerDown({ x: 100, y: 100 }, false);

    editor.pointerMove({ x: 108, y: 108 }, none);

    expect(editor.getGesture()).toMatchObject({ guides: [] });
  });

  it('is one history entry, whatever the guides did', () => {
    const editor = resizing();
    grabSouthEast(editor);
    editor.pointerMove({ x: 600, y: 224 }, none);
    editor.pointerUp();

    editor.undo();

    expect(editor.getBoard().shapes[0]).toMatchObject({ w: 220, x: 80 });
  });
});
