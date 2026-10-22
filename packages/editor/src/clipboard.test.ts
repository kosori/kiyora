import { createEditor } from '@kiyora/editor';
import {
  type Board,
  type ConnectorShape,
  type FigureShape,
  type FrameShape,
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
  id: 'a',
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

const frame = (overrides: Partial<FrameShape> = {}): Shape => ({
  clip: true,
  h: 200,
  id: 'f',
  kind: 'frame',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  variant: 'plain',
  w: 300,
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

describe('duplicating the selection', () => {
  it('makes a copy with a fresh id, offset so it is visible', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);

    editor.duplicate();

    const { shapes } = editor.getBoard();
    expect(shapes).toHaveLength(2);
    expect(shapes[1]?.id).not.toBe('a');
    expect(shapes[1]).toMatchObject({ x: 104, y: 104 });
  });

  it('is one undo, not one entry per shape', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 200 })])
    );
    editor.setSelection(['a', 'b']);

    editor.duplicate();
    expect(editor.getBoard().shapes).toHaveLength(4);

    editor.undo();

    expect(editor.getBoard().shapes).toHaveLength(2);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('carries a frame’s members, re-parented to the copy', () => {
    const editor = createEditor(
      board([frame(), rectangle({ id: 'm', parentId: 'f', x: 20, y: 20 })])
    );
    editor.setSelection(['f']);

    editor.duplicate();

    const { shapes } = editor.getBoard();
    expect(shapes).toHaveLength(4);
    const frameCopy = shapes.find(
      (shape) => shape.kind === 'frame' && shape.id !== 'f'
    );
    const memberCopy = shapes.find(
      (shape) => shape.id !== 'm' && shape.parentId === frameCopy?.id
    );
    expect(frameCopy?.id).toBeDefined();
    expect(memberCopy).toBeDefined();
    expect(memberCopy).toMatchObject({ x: 44, y: 44 });
  });
});

describe('cutting, copying and pasting', () => {
  it('copies without touching the board or the history', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);
    const before = editor.getBoard();

    editor.copy();

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('says whether there is anything to paste, so a menu can disable an empty clipboard', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);

    expect(editor.canPaste()).toBe(false);

    editor.copy();

    expect(editor.canPaste()).toBe(true);
  });

  it('does not count an empty selection as something to paste', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.copy();

    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
    expect(editor.canPaste()).toBe(false);
  });

  it('pastes a copy clear of the original', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);
    editor.copy();

    editor.paste();

    const { shapes } = editor.getBoard();
    expect(shapes).toHaveLength(2);
    expect(shapes[1]).toMatchObject({ x: 104, y: 104 });
  });

  it('cascades a repeated paste so the second is not hidden by the first', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);
    editor.copy();

    editor.paste();
    editor.paste();

    const { shapes } = editor.getBoard();
    expect(shapes).toHaveLength(3);
    expect(shapes[1]).toMatchObject({ x: 104, y: 104 });
    expect(shapes[2]).toMatchObject({ x: 128, y: 128 });
  });

  it('rebinds a connector copied with the two shapes it joins to the copies', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 300 })])
    );
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });
    editor.setSelection(['a', 'b', 'connector-1']);

    editor.copy();
    editor.paste();

    const after = editor.getBoard();
    const copy = after.shapes.find(
      (shape): shape is ConnectorShape => shape.id === 'connector-2'
    );
    expect(copy?.from).toEqual({ kind: 'bound', shapeId: 'rectangle-1' });
    expect(copy?.to).toEqual({ kind: 'bound', shapeId: 'rectangle-2' });

    const original = after.shapes.find(
      (shape): shape is ConnectorShape => shape.id === 'connector-1'
    );
    expect(original?.from).toEqual({ kind: 'bound', shapeId: 'a' });
    expect(original?.to).toEqual({ kind: 'bound', shapeId: 'b' });
  });

  it('brings a connector whose two ends are in the copied set, even when it is not selected', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 300 })])
    );
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });
    editor.setSelection(['a', 'b']);

    editor.copy();
    editor.paste();

    const after = editor.getBoard();
    const copy = after.shapes.find(
      (shape): shape is ConnectorShape => shape.id === 'connector-2'
    );
    expect(copy?.from).toEqual({ kind: 'bound', shapeId: 'rectangle-1' });
    expect(copy?.to).toEqual({ kind: 'bound', shapeId: 'rectangle-2' });
  });

  it('keeps the edge an end named when the shapes it joins are copied too', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 300 })])
    );
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });
    editor.setConnector('connector-1', {
      fromAnchor: { edge: 'top', fraction: 0.5 },
    });
    editor.setSelection(['a', 'b', 'connector-1']);

    editor.copy();
    editor.paste();

    const copy = editor
      .getBoard()
      .shapes.find(
        (shape): shape is ConnectorShape => shape.id === 'connector-2'
      );
    expect(copy?.from).toEqual({
      anchor: { edge: 'top', fraction: 0.5 },
      kind: 'bound',
      shapeId: 'rectangle-1',
    });
  });

  it('records a paste as one undo, not one entry per shape', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 200 })])
    );
    editor.setSelection(['a', 'b']);
    editor.copy();

    editor.paste();
    expect(editor.getBoard().shapes).toHaveLength(4);

    editor.undo();

    expect(editor.getBoard().shapes).toHaveLength(2);
    expect(editor.getHistory().canUndo).toBe(false);
  });
});

describe('cutting', () => {
  it('takes the selection off the board, and one undo puts it back', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 200 })])
    );
    editor.setSelection(['a']);

    editor.cut();

    expect(editor.getBoard().shapes.map((shape) => shape.id)).toEqual(['b']);

    editor.undo();

    expect(editor.getBoard().shapes.map((shape) => shape.id)).toEqual([
      'a',
      'b',
    ]);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('keeps what it cut on the clipboard, so a paste brings it back visible', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);

    editor.cut();
    editor.paste();

    const { shapes } = editor.getBoard();
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toMatchObject({ x: 104, y: 104 });
  });
});
