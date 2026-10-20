import { createEditor, selectionBounds } from '@kiyora/editor';
import {
  type Board,
  type FigureShape,
  type FrameShape,
  paintBoard,
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

const frame = (overrides: Partial<FrameShape> = {}): Shape => ({
  clip: true,
  h: 300,
  id: 'frame-1',
  kind: 'frame',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  variant: 'plain',
  w: 400,
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

const ids = (one: Board): string[] => one.shapes.map((shape) => shape.id);

/** The shapes the board paints at its top level, in paint order. */
const topLevel = (one: Board): (string | undefined)[] =>
  paintBoard(one, { theme: 'light' }).children.map((child) => child.shapeId);

/** The shapes painted inside `shapeId`, in paint order. */
const inside = (one: Board, shapeId: string): (string | undefined)[] =>
  paintBoard(one, { theme: 'light' })
    .children.find((child) => child.shapeId === shapeId)
    ?.children.map((child) => child.shapeId) ?? [];

const three = () =>
  board([
    rectangle({ id: 'a' }),
    rectangle({ id: 'b', x: 120 }),
    rectangle({ id: 'c', x: 240 }),
  ]);

const four = () =>
  board([
    rectangle({ id: 'a' }),
    rectangle({ id: 'b', x: 120 }),
    rectangle({ id: 'c', x: 240 }),
    rectangle({ id: 'd', x: 360 }),
  ]);

describe('bring to front and send to back', () => {
  it('brings the selection to the front, so it paints after everything else', () => {
    const editor = createEditor(three());
    editor.setSelection(['a']);

    editor.bringToFront();

    expect(ids(editor.getBoard())).toEqual(['b', 'c', 'a']);
    expect(topLevel(editor.getBoard())).toEqual(['b', 'c', 'a']);
  });

  it('sends the selection to the back, so it paints before everything else', () => {
    const editor = createEditor(three());
    editor.setSelection(['c']);

    editor.sendToBack();

    expect(ids(editor.getBoard())).toEqual(['c', 'a', 'b']);
    expect(topLevel(editor.getBoard())).toEqual(['c', 'a', 'b']);
  });

  it('is one history entry, so one undo puts the order back', () => {
    const editor = createEditor(three());
    editor.setSelection(['a']);

    editor.bringToFront();
    expect(editor.getHistory().canUndo).toBe(true);

    editor.undo();

    expect(ids(editor.getBoard())).toEqual(['a', 'b', 'c']);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('lands nothing in undo when the selection already paints at the end', () => {
    const editor = createEditor(three());
    editor.setSelection(['c']);

    editor.bringToFront();

    expect(ids(editor.getBoard())).toEqual(['a', 'b', 'c']);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('lands nothing in undo when the selection already paints at the start', () => {
    const editor = createEditor(three());
    editor.setSelection(['a']);

    editor.sendToBack();

    expect(ids(editor.getBoard())).toEqual(['a', 'b', 'c']);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('does nothing with an empty selection', () => {
    const editor = createEditor(three());

    editor.bringToFront();
    editor.sendToBack();

    expect(ids(editor.getBoard())).toEqual(['a', 'b', 'c']);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('reorders a locked shape, because paint order is not a transform', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', locked: true }),
        rectangle({ id: 'b', x: 120 }),
      ])
    );
    editor.setSelection(['a']);

    editor.bringToFront();

    expect(ids(editor.getBoard())).toEqual(['b', 'a']);
  });
});

describe('one step either way', () => {
  it('brings the selection forward one place', () => {
    const editor = createEditor(three());
    editor.setSelection(['a']);

    editor.bringForward();

    expect(ids(editor.getBoard())).toEqual(['b', 'a', 'c']);
  });

  it('sends the selection backward one place', () => {
    const editor = createEditor(three());
    editor.setSelection(['c']);

    editor.sendBackward();

    expect(ids(editor.getBoard())).toEqual(['a', 'c', 'b']);
  });

  it('lands nothing in undo when there is nowhere to step', () => {
    const editor = createEditor(three());
    editor.setSelection(['c']);

    editor.bringForward();
    editor.setSelection(['a']);
    editor.sendBackward();

    expect(ids(editor.getBoard())).toEqual(['a', 'b', 'c']);
    expect(editor.getHistory().canUndo).toBe(false);
  });
});

describe('a multi-selection', () => {
  it('moves as one block and keeps its own paint order', () => {
    const editor = createEditor(three());
    editor.setSelection(['a', 'b']);

    editor.bringForward();

    expect(ids(editor.getBoard())).toEqual(['c', 'a', 'b']);
  });

  it('moves to the back as one block, keeping its own paint order', () => {
    const editor = createEditor(three());
    editor.setSelection(['b', 'c']);

    editor.sendToBack();
    expect(ids(editor.getBoard())).toEqual(['b', 'c', 'a']);
    expect(selectionBounds(editor.getBoard(), editor.getSelection())).toEqual({
      h: 60,
      w: 220,
      x: 120,
      y: 0,
    });
  });
});

describe('a group', () => {
  const grouped = () => {
    const editor = createEditor(four());
    editor.setSelection(['b', 'c']);
    editor.groupSelection();

    return editor;
  };

  it('moves as one shape, and its members keep painting inside it', () => {
    const editor = grouped();
    const [groupId] = editor.getSelection();

    editor.bringToFront();

    const after = editor.getBoard();
    expect(ids(after)).toEqual(['a', 'd', groupId, 'b', 'c']);
    expect(topLevel(after)).toEqual(['a', 'd', groupId]);
    expect(inside(after, groupId ?? '')).toEqual(['b', 'c']);
  });

  it('sends the group to the back with every member still its own', () => {
    const editor = grouped();
    const [groupId] = editor.getSelection();

    editor.sendToBack();

    const after = editor.getBoard();
    expect(ids(after)).toEqual([groupId, 'b', 'c', 'a', 'd']);
    expect(
      after.shapes
        .filter((shape) => shape.id === 'b' || shape.id === 'c')
        .map((shape) => shape.parentId)
    ).toEqual([groupId, groupId]);
  });
});

describe("a frame's members", () => {
  const framed = () =>
    board([
      frame({ id: 'f' }),
      rectangle({ id: 'a', parentId: 'f', x: 20, y: 20 }),
      rectangle({ id: 'b', parentId: 'f', x: 160, y: 20 }),
      rectangle({ id: 'c', x: 500 }),
    ]);

  it('reorder inside the frame, never past it', () => {
    const editor = createEditor(framed());
    editor.setSelection(['a']);

    editor.bringToFront();

    const after = editor.getBoard();
    expect(topLevel(after)).toEqual(['f', 'c']);
    expect(inside(after, 'f')).toEqual(['b', 'a']);
  });

  it('sends a member to the back of the frame only', () => {
    const editor = createEditor(framed());
    editor.setSelection(['b']);

    editor.sendToBack();

    const after = editor.getBoard();
    expect(topLevel(after)).toEqual(['f', 'c']);
    expect(inside(after, 'f')).toEqual(['b', 'a']);
  });

  it('moves a member and a top-level shape each inside its own list, keeping the selection in paint order', () => {
    const editor = createEditor(framed());
    editor.setSelection(['a', 'c']);

    editor.sendToBack();

    const after = editor.getBoard();
    expect(topLevel(after)).toEqual(['c', 'f']);
    expect(inside(after, 'f')).toEqual(['a', 'b']);
    expect(editor.getSelection()).toEqual(['c', 'a']);
  });
});

describe('a group selected with a top-level shape', () => {
  it('moves the group as a whole and the shape with it', () => {
    const editor = createEditor(four());
    editor.setSelection(['b', 'c']);
    editor.groupSelection();
    const groupId = editor.getSelection()[0] ?? '';
    editor.setSelection(['a', groupId]);

    editor.bringToFront();

    const after = editor.getBoard();
    expect(topLevel(after)).toEqual(['d', 'a', groupId]);
    expect(inside(after, groupId)).toEqual(['b', 'c']);
  });
});
