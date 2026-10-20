import { createEditor } from '@kiyora/editor';
import {
  type Board,
  type FigureShape,
  parseBoard,
  SCHEMA_VERSION,
  type Shape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const none = { bypassSnap: false, constrain: false } as const;
const bypass = { bypassSnap: true, constrain: false } as const;

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

describe('a locked shape', () => {
  it('stays where it is when the selection is nudged', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a', locked: true, x: 80, y: 80 })])
    );
    editor.setSelection(['a']);

    editor.nudge(1, 0);

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 80, y: 80 });
  });

  it('nudges an unlocked shape while its locked neighbour stays put', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'locked', locked: true, x: 0, y: 0 }),
        rectangle({ id: 'free', x: 200, y: 0 }),
      ])
    );
    editor.setSelection(['locked', 'free']);

    editor.nudge(1, 0);

    const [locked, free] = editor.getBoard().shapes;

    expect(locked).toMatchObject({ x: 0, y: 0 });
    expect(free).toMatchObject({ x: 201, y: 0 });
  });

  it('keeps its style when the selection is restyled', () => {
    const editor = createEditor(board([rectangle({ id: 'a', locked: true })]));
    editor.setSelection(['a']);

    editor.restyle({ opacity: 0.5, style: { fill: 'red' } });

    expect(editor.getBoard().shapes[0]).toMatchObject({
      opacity: 1,
      style: { fill: 'blue' },
    });
  });

  it('restyles an unlocked shape while its locked neighbour keeps its style', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'locked', locked: true }),
        rectangle({ id: 'free', x: 200 }),
      ])
    );
    editor.setSelection(['locked', 'free']);

    editor.restyle({ style: { fill: 'red' } });

    const [locked, free] = editor.getBoard().shapes;

    expect(locked).toMatchObject({ style: { fill: 'blue' } });
    expect(free).toMatchObject({ style: { fill: 'red' } });
  });

  it('keeps its box when the selection is resized', () => {
    const editor = createEditor(board([rectangle({ id: 'a', locked: true })]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 100, y: 60 }, false);
    editor.pointerMove({ x: 200, y: 120 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 60,
      w: 100,
      x: 0,
      y: 0,
    });
  });

  it('resizes an unlocked shape while its locked neighbour keeps its box', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'locked', locked: true }),
        rectangle({ id: 'free', x: 200 }),
      ])
    );
    editor.setSelection(['locked', 'free']);

    editor.pointerDown({ x: 300, y: 30 }, false);
    editor.pointerMove({ x: 336, y: 30 }, none);

    const [locked, free] = editor.getBoard().shapes;

    expect(locked).toMatchObject({ h: 60, w: 100, x: 0, y: 0 });
    expect(free).toMatchObject({ h: 60, w: 112, x: 224, y: 0 });
  });

  it('keeps its angle when the selection is rotated', () => {
    const editor = createEditor(board([rectangle({ id: 'a', locked: true })]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 50, y: -22 }, false);
    editor.pointerMove({ x: 120, y: 30 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({
      rotation: 0,
      x: 0,
      y: 0,
    });
  });

  it('stays put while an unlocked shape beside it moves', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'locked', locked: true, x: 0, y: 0 }),
        rectangle({ id: 'free', x: 200, y: 50 }),
      ])
    );
    editor.setSelection(['locked', 'free']);

    editor.pointerDown({ x: 250, y: 80 }, false);
    editor.pointerMove({ x: 290, y: 80 }, bypass);

    const [locked, free] = editor.getBoard().shapes;

    expect(locked).toMatchObject({ x: 0, y: 0 });
    expect(free).toMatchObject({ x: 240, y: 50 });
  });

  it('is not caught by a marquee, so a sweep never picks it up', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'locked', locked: true, x: 0, y: 0 }),
        rectangle({ id: 'free', x: 200, y: 0 }),
      ])
    );

    editor.pointerDown({ x: -40, y: -40 }, false);
    editor.pointerMove({ x: 340, y: 200 }, none);
    editor.pointerUp();

    expect(editor.getSelection()).toEqual(['free']);
  });
});

describe('reaching a locked shape', () => {
  it('leaves a plain click unpicked, and selects it when alt is held', () => {
    const editor = createEditor(board([rectangle({ id: 'a', locked: true })]));

    editor.pointerDown({ x: 50, y: 30 }, false);
    expect(editor.getSelection()).toEqual([]);

    editor.pointerDown({ x: 50, y: 30 }, false, true);
    expect(editor.getSelection()).toEqual(['a']);
  });
});

describe('locking and unlocking', () => {
  it('locks every selected shape as one entry, which one undo takes back', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 200 })])
    );
    editor.setSelection(['a', 'b']);

    editor.setLocked(true);

    expect(editor.getBoard().shapes.map((shape) => shape.locked)).toEqual([
      true,
      true,
    ]);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: true });

    editor.undo();

    expect(editor.getBoard().shapes.map((shape) => shape.locked)).toEqual([
      false,
      false,
    ]);
    expect(editor.getHistory()).toEqual({ canRedo: true, canUndo: false });
  });

  it('unlocks as one entry, so a locked shape comes back with one undo', () => {
    const editor = createEditor(board([rectangle({ id: 'a', locked: true })]));
    editor.setSelection(['a']);

    editor.setLocked(false);

    expect(editor.getBoard().shapes[0]?.locked).toBe(false);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: true });

    editor.undo();

    expect(editor.getBoard().shapes[0]?.locked).toBe(true);
    expect(editor.getHistory()).toEqual({ canRedo: true, canUndo: false });
  });

  it('writes nothing when the selection already wears the asked-for lock', () => {
    const editor = createEditor(board([rectangle({ id: 'a', locked: true })]));
    editor.setSelection(['a']);

    editor.setLocked(true);

    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });
});
