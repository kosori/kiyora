import { createEditor } from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (title: string): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [],
    title,
    updatedAt: 1_700_000_000_000,
  });

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const shape = (id: string, x: number) => ({
  h: 60,
  id,
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 100,
  x,
  y: 0,
});

/** A frame wearing the plain variant, holding nothing yet. */
const frame = () => ({
  ...shape('frame-1', 0),
  clip: true,
  kind: 'frame',
  variant: 'plain',
});

/** A board with a frame and a rectangle, so a variant change can be shown to skip the rectangle. */
const framed = (): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-3',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [frame(), shape('two', 200)],
    title: 'Framed',
    updatedAt: 1_700_000_000_000,
  });

/** A board with two shapes, so a change can be shown to reach a whole selection. */
const twoShapes = (): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-2',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [shape('one', 0), shape('two', 200)],
    title: 'Two',
    updatedAt: 1_700_000_000_000,
  });

describe('the editor', () => {
  it('holds the board it was created with', () => {
    const editor = createEditor(board('First'));

    expect(editor.getBoard().title).toBe('First');
  });

  it('publishes a replacement to every subscriber', () => {
    const editor = createEditor(board('First'));
    const seen: string[] = [];
    editor.subscribe(() => seen.push(editor.getBoard().title));

    editor.setBoard(board('Second'));

    expect(seen).toEqual(['Second']);
  });

  it('keeps the same board reference until a change is published', () => {
    const editor = createEditor(board('First'));
    const before = editor.getBoard();

    expect(editor.getBoard()).toBe(before);

    editor.setBoard(board('Second'));

    expect(editor.getBoard()).not.toBe(before);
  });

  it('stops publishing to an unsubscribed listener', () => {
    const editor = createEditor(board('First'));
    const seen: string[] = [];
    const stop = editor.subscribe(() => seen.push(editor.getBoard().title));

    stop();
    editor.setBoard(board('Second'));

    expect(seen).toEqual([]);
  });
});

describe('the view', () => {
  it('opens where the board was left, on the select tool', () => {
    const editor = createEditor({
      ...board('First'),
      camera: { x: 12, y: -30, zoom: 0.5 },
    });

    expect(editor.getView()).toEqual({
      camera: { x: 12, y: -30, zoom: 0.5 },
      icon: null,
      tool: 'select',
      zen: false,
    });
  });

  it('returns the same view reference until the view changes', () => {
    const editor = createEditor(board('First'));
    const before = editor.getView();

    expect(editor.getView()).toBe(before);

    editor.setCamera({ x: 1, y: 1, zoom: 2 });

    expect(editor.getView()).not.toBe(before);
  });

  it('publishes a camera change to the view without publishing a board change', () => {
    const editor = createEditor(board('First'));
    const before = editor.getBoard();
    const boards: string[] = [];
    const views: string[] = [];
    editor.subscribe(() => boards.push('board'));
    editor.subscribeView(() => views.push('view'));

    editor.setCamera({ x: 10, y: 10, zoom: 2 });

    expect(editor.getView().camera).toEqual({ x: 10, y: 10, zoom: 2 });
    expect(editor.getBoard()).toBe(before);
    expect(boards).toEqual([]);
    expect(views).toEqual(['view']);
  });

  it('publishes a tool change to the view without publishing a board change', () => {
    const editor = createEditor(board('First'));
    const before = editor.getBoard();
    const boards: string[] = [];
    editor.subscribe(() => boards.push('board'));

    editor.setTool('hand');

    expect(editor.getView().tool).toBe('hand');
    expect(editor.getBoard()).toBe(before);
    expect(boards).toEqual([]);
  });

  it('hides the chrome without touching the board, the history or a save', () => {
    const editor = createEditor(board('First'));
    const before = editor.getBoard();
    const history = editor.getHistory();
    const boards: string[] = [];
    const views: string[] = [];
    editor.subscribe(() => boards.push('board'));
    editor.subscribeView(() => views.push('view'));

    editor.setZen(true);

    expect(editor.getView().zen).toBe(true);
    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual(history);
    expect(boards).toEqual([]);
    expect(views).toEqual(['view']);
  });

  it('leaves the view where it is when the board is replaced', () => {
    const editor = createEditor(board('First'));
    editor.setCamera({ x: 40, y: 40, zoom: 2 });

    editor.setBoard(board('Second'));

    expect(editor.getView().camera).toEqual({ x: 40, y: 40, zoom: 2 });
  });

  it('leaves board subscribers alone when the view changes', () => {
    const editor = createEditor(board('First'));
    const views: string[] = [];
    editor.subscribeView(() => views.push('view'));

    editor.setCamera({ x: 0, y: 0, zoom: 1.5 });
    editor.setTool('hand');

    expect(views).toHaveLength(2);
  });
});

describe('restyling the selection', () => {
  it('applies one change to every selected shape', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['one', 'two']);

    editor.restyle({ style: { fill: 'red', fillStyle: 'bold' } });

    for (const one of editor.getBoard().shapes) {
      expect(one.style).toMatchObject({ fill: 'red', fillStyle: 'bold' });
    }
  });

  it('sets the opacity of every selected shape, since opacity is not the palette\u2019s', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['one', 'two']);

    editor.restyle({ opacity: 0.5 });

    expect(editor.getBoard().shapes.map((one) => one.opacity)).toEqual([
      0.5, 0.5,
    ]);
  });

  it('touches only the selection, leaving the rest of the board alone', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['two']);

    editor.restyle({ style: { fill: 'red' } });

    expect(editor.getBoard().shapes[0]?.style.fill).toBe('blue');
    expect(editor.getBoard().shapes[1]?.style.fill).toBe('red');
  });

  it('publishes exactly one board change, so history sees one entry', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['one']);
    const seen: Board[] = [];
    editor.subscribe(() => seen.push(editor.getBoard()));

    editor.restyle({ opacity: 0.5, style: { strokeWidth: 4 } });

    expect(seen).toHaveLength(1);
  });

  it('leaves the board alone, and publishes nothing, with an empty selection', () => {
    const editor = createEditor(twoShapes());
    const before = editor.getBoard();
    const seen: Board[] = [];
    editor.subscribe(() => seen.push(editor.getBoard()));

    editor.restyle({ style: { fill: 'red' } });

    expect(editor.getBoard()).toBe(before);
    expect(seen).toEqual([]);
  });

  it('changes a frame\u2019s variant in one history entry and leaves non-frames alone', () => {
    const editor = createEditor(framed());
    editor.setSelection(['frame-1', 'two']);
    const seen: Board[] = [];
    editor.subscribe(() => seen.push(editor.getBoard()));

    editor.restyle({ variant: 'phone' });

    expect(seen).toHaveLength(1);
    expect(editor.getBoard().shapes[0]).toMatchObject({
      kind: 'frame',
      variant: 'phone',
    });
    expect(editor.getBoard().shapes[1]).not.toHaveProperty('variant');

    editor.undo();

    expect(editor.getBoard().shapes[0]).toMatchObject({ variant: 'plain' });
  });

  it('wears the restyled style on the next shape placed, so a board stays one colour', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['one']);

    editor.restyle({ style: { corner: 'rounded', fill: 'red' } });
    editor.setTool('rectangle');
    editor.placeShape({ from: { x: 500, y: 500 }, to: { x: 500, y: 500 } });

    expect(editor.getBoard().shapes.at(-1)?.style).toMatchObject({
      corner: 'rounded',
      fill: 'red',
    });
  });
});

describe('placing an icon', () => {
  it('arms the icon tool and places the name it was given, then returns to select', () => {
    const editor = createEditor(board('Icons'));
    const placement = { from: { x: 10, y: 20 }, to: { x: 110, y: 120 } };

    editor.setIcon('star');

    expect(editor.getView()).toMatchObject({ icon: 'star', tool: 'icon' });

    const placed = editor.placeShape(placement);

    expect(placed).toMatchObject({ kind: 'icon', name: 'star' });
    expect(editor.getBoard().shapes[0]).toMatchObject({
      h: 100,
      kind: 'icon',
      name: 'star',
      w: 100,
      x: 10,
      y: 20,
    });
    expect(editor.getView()).toMatchObject({ icon: null, tool: 'select' });
  });

  it('places nothing when the icon tool was armed without a name', () => {
    const editor = createEditor(board('Icons'));

    editor.setTool('icon');

    expect(
      editor.placeShape({ from: { x: 0, y: 0 }, to: { x: 10, y: 10 } })
    ).toBeNull();
    expect(editor.getBoard().shapes).toEqual([]);
  });

  it('clears the pending name when another tool is chosen', () => {
    const editor = createEditor(board('Icons'));

    editor.setIcon('star');
    editor.setTool('select');

    expect(editor.getView()).toMatchObject({ icon: null, tool: 'select' });
  });
});

describe('the board theme', () => {
  it('sets the canvas as one history entry, so one undo puts the old one back', () => {
    const editor = createEditor(board('Theme'));

    editor.setTheme('dark');

    expect(editor.getBoard().settings.theme).toBe('dark');
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: true });

    editor.undo();

    expect(editor.getBoard().settings.theme).toBe('light');
  });

  it('publishes nothing, and records no history, when the board already wears it', () => {
    const editor = createEditor(board('Theme'));
    const before = editor.getBoard();
    const seen: Board[] = [];
    editor.subscribe(() => seen.push(editor.getBoard()));

    editor.setTheme('light');

    expect(editor.getBoard()).toBe(before);
    expect(seen).toEqual([]);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });
});
