import { createEditor, NO_GESTURE_MODIFIERS } from '@kiyora/editor';
import {
  type Board,
  type InkShape,
  inkPath,
  inkWidths,
  parseBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [],
    title: 'Ink',
    updatedAt: 1_700_000_000_000,
  });

const ink = (editor: ReturnType<typeof createEditor>): InkShape => {
  const [shape] = editor.getBoard().shapes;
  if (shape?.kind !== 'ink') {
    throw new Error('the board holds no ink stroke');
  }
  return shape;
};

describe('drawing ink', () => {
  it('turns one drag into one stroke and one history entry', () => {
    const editor = createEditor(board());
    editor.setTool('ink');

    editor.pointerDown({ x: 10, y: 10 }, false);
    editor.pointerMove({ x: 40, y: 30 }, NO_GESTURE_MODIFIERS);
    editor.pointerMove({ x: 90, y: 60 }, NO_GESTURE_MODIFIERS);
    editor.pointerMove({ x: 150, y: 40 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    expect(editor.getBoard().shapes).toHaveLength(1);
    expect(ink(editor).kind).toBe('ink');
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: true });

    editor.undo();

    expect(editor.getBoard().shapes).toEqual([]);
    expect(editor.getHistory()).toEqual({ canRedo: true, canUndo: false });
  });

  it('keeps the pressure the pen reported, and invents none for a mouse', () => {
    const pen = createEditor(board());
    pen.setTool('ink');
    pen.pointerDown({ x: 0, y: 0 }, false, false, 0.15);
    pen.pointerMove({ x: 60, y: 0 }, NO_GESTURE_MODIFIERS, 0.95);
    pen.pointerMove({ x: 120, y: 0 }, NO_GESTURE_MODIFIERS, 0.2);
    pen.pointerUp();

    const mouse = createEditor(board());
    mouse.setTool('ink');
    mouse.pointerDown({ x: 0, y: 0 }, false);
    mouse.pointerMove({ x: 60, y: 0 }, NO_GESTURE_MODIFIERS);
    mouse.pointerMove({ x: 120, y: 0 }, NO_GESTURE_MODIFIERS);
    mouse.pointerUp();

    expect(ink(pen).points.map((point) => point.pressure)).toEqual([
      0.15, 0.95, 0.2,
    ]);
    expect(ink(mouse).points.map((point) => point.pressure)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(
      new Set(inkWidths(ink(pen)).map((width) => width.toFixed(4))).size
    ).toBe(3);
    expect(new Set(inkWidths(ink(mouse))).size).toBe(1);
    expect(inkPath(ink(pen))).not.toBe(inkPath(ink(mouse)));
  });

  it('draws a highlighter in its own mode, wider than the pen it was armed with', () => {
    const editor = createEditor(board());
    editor.setTool('highlighter');

    editor.pointerDown({ x: 0, y: 0 }, false);
    editor.pointerMove({ x: 100, y: 0 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    expect(ink(editor)).toMatchObject({
      id: 'highlighter-1',
      mode: 'highlighter',
    });
    expect(Math.max(...inkWidths(ink(editor)))).toBeGreaterThan(
      ink(editor).style.strokeWidth
    );
  });

  it('cancels a stroke without leaving it on the board or in history', () => {
    const editor = createEditor(board());
    editor.setTool('ink');

    editor.pointerDown({ x: 0, y: 0 }, false);
    editor.pointerMove({ x: 100, y: 50 }, NO_GESTURE_MODIFIERS);
    editor.cancelGesture();

    expect(editor.getBoard().shapes).toEqual([]);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('moves a stroke as one shape and locks it like any other', () => {
    const editor = createEditor(board());
    editor.setTool('ink');
    editor.pointerDown({ x: 0, y: 0 }, false);
    editor.pointerMove({ x: 100, y: 0 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    const { id } = ink(editor);
    const before = inkPath(ink(editor));
    editor.setSelection([id]);
    editor.nudge(10, 5);

    expect(ink(editor)).toMatchObject({ x: 10, y: 5 });
    expect(inkPath(ink(editor))).not.toBe(before);

    const moved = ink(editor);
    editor.setLocked(true);
    editor.nudge(10, 0);

    expect(ink(editor)).toMatchObject({ locked: true, x: moved.x, y: moved.y });
  });

  it('picks the stroke on its line, so a click near it selects it', () => {
    const editor = createEditor(board());
    editor.setTool('ink');
    editor.pointerDown({ x: 0, y: 0 }, false);
    editor.pointerMove({ x: 200, y: 0 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();
    const { id } = ink(editor);

    editor.setTool('select');
    editor.pointerDown({ x: 100, y: 3 }, false);
    editor.pointerUp();

    expect(editor.getSelection()).toEqual([id]);
  });
});
