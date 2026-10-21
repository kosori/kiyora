import { createEditor } from '@kiyora/editor';
import {
  type Board,
  type FigureShape,
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

const rectangle = (overrides: Partial<FigureShape> = {}): Shape => ({
  h: 60,
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

const none = { bypassSnap: false, constrain: false } as const;
const bypass = { bypassSnap: true, constrain: false } as const;
const shift = { bypassSnap: false, constrain: true } as const;

describe('resizing a selection from a handle', () => {
  const starter = () => rectangle({ h: 140, id: 'a', w: 220, x: 80, y: 80 });

  it('opens a resize on the handle the pointer lands on, keeping the selection', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);

    expect(editor.getGesture()).toEqual({
      guides: [],
      handle: 'se',
      kind: 'resize',
    });
    expect(editor.getSelection()).toEqual(['a']);
  });

  it('moves the corner a corner handle drags', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);
    editor.pointerMove({ x: 360, y: 304 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 224,
      w: 280,
      x: 80,
      y: 80,
    });
  });

  it('moves only the edge an edge handle drags', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 150 }, false);
    editor.pointerMove({ x: 360, y: 500 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 140,
      w: 280,
      x: 80,
      y: 80,
    });
  });

  it('never lets a shape invert or vanish', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);
    editor.pointerMove({ x: 84, y: 84 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 8,
      w: 8,
      x: 80,
      y: 80,
    });
  });

  it('grows from the centre when alt is held', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);
    editor.pointerMove({ x: 360, y: 216 }, bypass);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 132,
      w: 340,
      x: 20,
      y: 84,
    });
  });

  it('keeps the ratio when shift is held', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);
    editor.pointerMove({ x: 520, y: 360 }, shift);

    expect(editor.getBoard().shapes[0]).toMatchObject({ h: 280, w: 440 });
  });

  it('leaves the grid when alt is held, so a resize can bypass the snap too', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);
    editor.pointerMove({ x: 363, y: 219 }, bypass);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 138,
      w: 346,
      x: 17,
      y: 81,
    });
  });

  it('lands the resized edge on the grid without the bypass', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);
    editor.pointerMove({ x: 363, y: 219 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 136,
      w: 280,
      x: 80,
      y: 80,
    });
  });

  it('keeps the resize when the pointer lifts', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);
    editor.pointerMove({ x: 360, y: 304 }, none);
    editor.pointerUp();

    expect(editor.getGesture()).toEqual({ kind: 'idle' });
    expect(editor.getBoard().shapes[0]).toMatchObject({ h: 224, w: 280 });
  });

  it('puts the shape back when the resize is cancelled', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 300, y: 220 }, false);
    editor.pointerMove({ x: 360, y: 304 }, none);
    editor.cancelGesture();

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 140,
      w: 220,
      x: 80,
      y: 80,
    });
    expect(editor.getGesture()).toEqual({ kind: 'idle' });
  });

  it('resizes a turned shape in its own frame, pinning the anchor corner', () => {
    const editor = createEditor(
      board([rectangle({ h: 100, id: 'a', rotation: 90, w: 100, x: 0, y: 0 })])
    );
    editor.setSelection(['a']);

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 48, y: 152 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 52,
      rotation: 90,
      w: 152,
      x: -2,
      y: 50,
    });
  });
});

describe('rotating a selection from the rotate handle', () => {
  const starter = () => rectangle({ h: 140, id: 'a', w: 220, x: 80, y: 80 });

  it('opens a rotate on the rotate handle', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 190, y: 58 }, false);

    expect(editor.getGesture()).toEqual({ kind: 'rotate' });
  });

  it('turns the shape to the angle the pointer sweeps to', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 190, y: 58 }, false);
    editor.pointerMove({ x: 290, y: 150 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({ rotation: 90 });
  });

  it('lands on a fifteen-degree step when shift is held', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 190, y: 58 }, false);
    editor.pointerMove({ x: 224.2, y: 56 }, shift);

    expect(editor.getBoard().shapes[0]?.rotation).toBe(15);
  });

  it('returns a rotation to zero when the pointer sweeps back', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 190, y: 58 }, false);
    editor.pointerMove({ x: 290, y: 150 }, none);
    editor.pointerUp();

    editor.pointerDown({ x: 190, y: 18 }, false);
    editor.pointerMove({ x: 98, y: 150 }, none);

    expect(editor.getBoard().shapes[0]?.rotation).toBe(0);
  });

  it('restores the rotation when the rotate is cancelled', () => {
    const editor = createEditor(board([starter()]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 190, y: 58 }, false);
    editor.pointerMove({ x: 290, y: 150 }, none);
    editor.cancelGesture();

    expect(editor.getBoard().shapes[0]?.rotation).toBe(0);
    expect(editor.getGesture()).toEqual({ kind: 'idle' });
  });
});
