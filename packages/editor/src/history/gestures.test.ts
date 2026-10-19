import {
  createEditor,
  type HistoryState,
  NO_GESTURE_MODIFIERS,
} from '@kiyora/editor';
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

describe('the history a gesture leaves behind', () => {
  it('records a drag as one entry, not one per pointer move', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 120, y: 100 }, NO_GESTURE_MODIFIERS);
    editor.pointerMove({ x: 140, y: 100 }, NO_GESTURE_MODIFIERS);
    editor.pointerMove({ x: 160, y: 100 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    editor.undo();

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 80, y: 80 });
    expect(editor.getHistory()).toEqual({ canRedo: true, canUndo: false });
  });

  it('keeps a drag that never moved out of the history, so a click costs nothing', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerUp();

    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('collapses a run of nudges into one entry', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);

    editor.nudge(1, 0);
    editor.nudge(1, 0);
    editor.nudge(1, 0);

    editor.undo();

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 80, y: 80 });
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('ends a run of nudges, so the next run is a second entry', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);

    editor.nudge(1, 0);
    editor.nudge(1, 0);
    editor.endNudgeRun();
    editor.nudge(1, 0);

    editor.undo();
    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 82, y: 80 });

    editor.undo();
    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 80, y: 80 });
  });

  it('ends a run when the selection changes, so two runs undo apart', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 0 }),
      ])
    );

    editor.setSelection(['a']);
    editor.nudge(1, 0);
    editor.nudge(1, 0);

    editor.setSelection(['b']);
    editor.nudge(1, 0);
    editor.nudge(1, 0);

    editor.undo();
    expect(editor.getBoard().shapes.map((shape) => shape.x)).toEqual([2, 200]);

    editor.undo();
    expect(editor.getBoard().shapes.map((shape) => shape.x)).toEqual([0, 200]);
  });

  it('leaves nothing behind when a gesture is cancelled', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 200, y: 200 }, NO_GESTURE_MODIFIERS);
    editor.cancelGesture();

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 80, y: 80 });
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('clears redo on any new gesture, so redo never surprises', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 140, y: 100 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    editor.undo();
    expect(editor.getHistory().canRedo).toBe(true);

    editor.nudge(1, 0);
    editor.endNudgeRun();

    expect(editor.getHistory().canRedo).toBe(false);
  });

  it('redo restores the gesture undo took away', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 140, y: 100 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    editor.undo();
    editor.redo();

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 120, y: 80 });
  });

  it('records a placement as one entry', () => {
    const editor = createEditor(board([]));
    editor.setTool('rectangle');

    editor.placeShape({ from: { x: 0, y: 0 }, to: { x: 100, y: 60 } });
    expect(editor.getBoard().shapes).toHaveLength(1);

    editor.undo();

    expect(editor.getBoard().shapes).toHaveLength(0);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('records a style change as one entry, however many properties it touched', () => {
    const editor = createEditor(board([rectangle({ id: 'a' })]));
    const original = editor.getBoard();
    editor.setSelection(['a']);

    editor.restyle({ style: { fill: 'red', strokeWidth: 4 } });

    expect(editor.getBoard().shapes[0]?.style).toMatchObject({
      fill: 'red',
      strokeWidth: 4,
    });

    editor.undo();

    expect(editor.getBoard()).toBe(original);
    expect(editor.getHistory().canUndo).toBe(false);
  });
});

describe('the label edit gesture', () => {
  const labelled = (text?: string) => board([rectangle({ id: 'a', text })]);

  it('records a finished edit as one entry, and undo brings the old label back', () => {
    const editor = createEditor(labelled('Old'));

    editor.beginTextEdit();
    editor.setText('a', 'New');
    editor.endTextEdit();

    expect(editor.getBoard().shapes[0]?.text).toBe('New');
    expect(editor.getHistory().canUndo).toBe(true);

    editor.undo();

    expect(editor.getBoard().shapes[0]?.text).toBe('Old');
    expect(editor.getHistory()).toEqual({ canRedo: true, canUndo: false });
  });

  it('collapses every write of one edit into one entry', () => {
    const editor = createEditor(labelled('Old'));

    editor.beginTextEdit();
    editor.setText('a', 'N');
    editor.setText('a', 'Ne');
    editor.setText('a', 'New');
    editor.endTextEdit();

    editor.undo();

    expect(editor.getBoard().shapes[0]?.text).toBe('Old');
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('restores the old label when an edit is cancelled, and pushes nothing', () => {
    const editor = createEditor(labelled('Old'));

    editor.beginTextEdit();
    editor.setText('a', 'New');
    editor.cancelTextEdit();

    expect(editor.getBoard().shapes[0]?.text).toBe('Old');
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('records a write outside an open edit as its own entry', () => {
    const editor = createEditor(labelled('Old'));

    editor.setText('a', 'New');

    expect(editor.getHistory().canUndo).toBe(true);

    editor.undo();

    expect(editor.getBoard().shapes[0]?.text).toBe('Old');
  });

  it('records a text style change as one entry', () => {
    const editor = createEditor(labelled('Old'));
    const [original] = editor.getBoard().shapes;

    editor.setTextStyle('a', { align: 'right', size: 32, valign: 'top' });

    expect(editor.getHistory().canUndo).toBe(true);

    editor.undo();

    expect(editor.getBoard().shapes[0]).toEqual(original);
  });

  it('keeps a text placement and the label typed into it as one entry', () => {
    const editor = createEditor(board([]));
    editor.setTool('text');

    editor.placeShape({ from: { x: 10, y: 10 }, to: { x: 10, y: 10 } });
    editor.beginTextEdit();
    editor.setText('text-1', 'Hello');
    editor.endTextEdit();

    expect(editor.getBoard().shapes[0]?.text).toBe('Hello');

    editor.undo();

    expect(editor.getBoard().shapes).toHaveLength(0);
    expect(editor.getHistory()).toEqual({ canRedo: true, canUndo: false });
  });

  it('records a text placement alone as one entry, before its overlay is finished', () => {
    const editor = createEditor(board([]));
    editor.setTool('text');

    editor.placeShape({ from: { x: 10, y: 10 }, to: { x: 10, y: 10 } });
    editor.undo();

    expect(editor.getBoard().shapes).toHaveLength(0);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('cancels a just-placed shape with its label, because the placement is that gesture', () => {
    const editor = createEditor(board([]));
    editor.setTool('text');

    editor.placeShape({ from: { x: 10, y: 10 }, to: { x: 10, y: 10 } });
    editor.beginTextEdit();
    editor.setText('text-1', 'Hello');
    editor.cancelTextEdit();

    expect(editor.getBoard().shapes).toHaveLength(0);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });
});

describe('resize and rotate gestures', () => {
  it('records a resize as one entry, and undo puts the box back', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 0, y: 0 })]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 100, y: 60 }, false);
    editor.pointerMove({ x: 140, y: 100 }, NO_GESTURE_MODIFIERS);
    editor.pointerMove({ x: 160, y: 120 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    expect(editor.getBoard().shapes[0]).toMatchObject({ h: 120, w: 160 });

    editor.undo();

    expect(editor.getBoard().shapes[0]).toMatchObject({ h: 60, w: 100 });
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('records a rotate as one entry', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 0, y: 0 })]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 50, y: -22 }, false);
    editor.pointerMove({ x: 100, y: 30 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    expect(editor.getBoard().shapes[0]?.rotation).not.toBe(0);

    editor.undo();

    expect(editor.getBoard().shapes[0]?.rotation).toBe(0);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('leaves nothing behind when a resize is cancelled', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 0, y: 0 })]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 100, y: 60 }, false);
    editor.pointerMove({ x: 160, y: 120 }, NO_GESTURE_MODIFIERS);
    editor.cancelGesture();

    expect(editor.getBoard().shapes[0]).toMatchObject({ h: 60, w: 100 });
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });
});

describe('history and the camera', () => {
  it('never records a pan, and leaves the board untouched', () => {
    const editor = createEditor(board([rectangle({ id: 'a' })]));
    const before = editor.getBoard();

    editor.setCamera({ x: 40, y: -20, zoom: 2 });

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('opens a new board with a clean slate, so an old undo cannot cross documents', () => {
    const editor = createEditor(board([rectangle({ id: 'a' })]));
    editor.setSelection(['a']);
    editor.nudge(1, 0);
    editor.endNudgeRun();
    expect(editor.getHistory().canUndo).toBe(true);

    editor.setBoard(board([rectangle({ id: 'b' })]));

    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });
});

describe('the history notification', () => {
  it('notifies the moment a drag commits, so the undo control cannot stay stale', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    const seen: HistoryState[] = [];
    editor.subscribeHistory(() => seen.push(editor.getHistory()));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 140, y: 100 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)?.canUndo).toBe(true);
    expect(editor.getHistory().canUndo).toBe(true);
  });
});
