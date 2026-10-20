import {
  boxBetween,
  createEditor,
  GRID,
  selectionBounds,
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

describe('selecting', () => {
  it('selects the shape a click lands on', () => {
    const editor = createEditor(board([rectangle({ id: 'a' })]));

    editor.pointerDown({ x: 50, y: 30 }, false);

    expect(editor.getSelection()).toEqual(['a']);
  });

  it('clears the selection on empty canvas', () => {
    const editor = createEditor(board([rectangle({ id: 'a' })]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 500, y: 500 }, false);

    expect(editor.getSelection()).toEqual([]);
  });

  it('adds a shift-clicked shape to the selection', () => {
    const editor = createEditor(
      board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 200 })])
    );

    editor.pointerDown({ x: 50, y: 30 }, false);
    editor.pointerDown({ x: 250, y: 30 }, true);

    expect(editor.getSelection()).toEqual(['a', 'b']);
  });

  it('takes a shift-clicked shape back out of the selection', () => {
    const editor = createEditor(board([rectangle({ id: 'a' })]));

    editor.pointerDown({ x: 50, y: 30 }, false);
    editor.pointerDown({ x: 50, y: 30 }, true);

    expect(editor.getSelection()).toEqual([]);
  });

  it('publishes the selection to every subscriber', () => {
    const editor = createEditor(board([rectangle({ id: 'a' })]));
    const seen: string[][] = [];
    editor.subscribeSelection(() => seen.push([...editor.getSelection()]));

    editor.pointerDown({ x: 50, y: 30 }, false);

    expect(seen).toEqual([['a']]);
  });

  it('reports the box around the whole selection', () => {
    const editor = createEditor(
      board([
        rectangle({ h: 60, id: 'a', w: 100, x: 0, y: 0 }),
        rectangle({ h: 40, id: 'b', w: 50, x: 200, y: 100 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    expect(selectionBounds(editor.getBoard(), editor.getSelection())).toEqual({
      h: 140,
      w: 250,
      x: 0,
      y: 0,
    });
  });
});

describe('moving the selection', () => {
  it('moves the whole selection, keeping relative positions', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 40 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.pointerDown({ x: 20, y: 20 }, false);
    editor.pointerMove({ x: 36, y: 36 }, none);

    const [a, b] = editor.getBoard().shapes;

    expect({ x: a?.x, y: a?.y }).toEqual({ x: 16, y: 16 });
    expect({ x: b?.x, y: b?.y }).toEqual({ x: 216, y: 56 });
  });

  it('snaps the move to the grid, so a dragged shape lands deliberately', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 105, y: 105 }, none);

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 88, y: 88 });
  });

  it('bypasses the snap for a deliberate off-grid placement', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 105, y: 105 }, bypass);

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 85, y: 85 });
  });

  it('keeps the move when the pointer lifts', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 140, y: 100 }, none);
    editor.pointerUp();

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 120, y: 80 });
    expect(editor.getGesture()).toEqual({ kind: 'idle' });
  });

  it('puts the selection back when the gesture is cancelled', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 200, y: 200 }, none);
    editor.cancelGesture();

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 80, y: 80 });
    expect(editor.getGesture()).toEqual({ kind: 'idle' });
  });

  it('publishes the move so the canvas repaints', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    let repaints = 0;
    editor.subscribe(() => {
      repaints += 1;
    });

    editor.pointerDown({ x: 100, y: 100 }, false);
    editor.pointerMove({ x: 140, y: 100 }, none);

    expect(repaints).toBe(1);
  });
});

describe('a marquee on empty canvas', () => {
  it('draws a box whichever way it is dragged', () => {
    expect(boxBetween({ x: 100, y: 100 }, { x: 20, y: 40 })).toEqual({
      h: 60,
      w: 80,
      x: 20,
      y: 40,
    });
  });

  it('selects every shape it covers when the pointer lifts', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 0 }),
        rectangle({ id: 'c', x: 600, y: 0 }),
      ])
    );

    editor.pointerDown({ x: -40, y: -40 }, false);
    editor.pointerMove({ x: 320, y: 200 }, none);

    expect(editor.getGesture()).toEqual({
      box: { h: 240, w: 360, x: -40, y: -40 },
      kind: 'marquee',
    });

    editor.pointerUp();

    expect(editor.getSelection()).toEqual(['a', 'b']);
    expect(editor.getGesture()).toEqual({ kind: 'idle' });
  });

  it('adds to the selection when the marquee is shifted', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 400, y: 0 }),
      ])
    );
    editor.setSelection(['b']);

    editor.pointerDown({ x: -40, y: -40 }, true);
    editor.pointerMove({ x: 200, y: 200 }, bypass);
    editor.pointerUp();

    expect(editor.getSelection()).toEqual(['a', 'b']);
  });

  it('leaves the selection alone when the marquee is cancelled', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 0, y: 0 })]));
    editor.setSelection(['a']);

    editor.pointerDown({ x: 400, y: 400 }, false);
    editor.pointerMove({ x: 500, y: 500 }, none);
    editor.cancelGesture();

    expect(editor.getSelection()).toEqual(['a']);
    expect(editor.getGesture()).toEqual({ kind: 'idle' });
  });
});

describe('nudging the selection', () => {
  it('moves one shape by a pixel', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);

    editor.nudge(1, 0);

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 81, y: 80 });
  });

  it('moves by a whole grid step when asked for a coarse nudge', () => {
    const editor = createEditor(board([rectangle({ id: 'a', x: 80, y: 80 })]));
    editor.setSelection(['a']);

    editor.nudge(0, GRID);

    expect(editor.getBoard().shapes[0]).toMatchObject({ x: 80, y: 88 });
  });

  it('nudges every selected shape by the same amount', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 40 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.nudge(-1, 0);

    expect(editor.getBoard().shapes.map((shape) => shape.x)).toEqual([-1, 199]);
  });

  it('does nothing without a selection, so a stray arrow costs nothing', () => {
    const editor = createEditor(board([rectangle({ id: 'a' })]));
    const before = editor.getBoard();

    editor.nudge(1, 0);

    expect(editor.getBoard()).toBe(before);
  });
});
