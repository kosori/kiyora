import { createEditor } from '@kiyora/editor';
import {
  type Board,
  type ConnectorShape,
  connectorInk,
  type FigureShape,
  parseBoard,
  SCHEMA_VERSION,
  type Shape,
  shapeBounds,
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

const connector = (overrides: Partial<ConnectorShape> = {}): Shape => ({
  end: 'arrow',
  from: { kind: 'bound', shapeId: 'a' },
  h: 0,
  id: 'connector-1',
  kind: 'connector',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  route: 'straight',
  start: 'none',
  style,
  to: { kind: 'bound', shapeId: 'b' },
  w: 0,
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

const shapeOf = (one: Board, id: string): Shape => {
  const shape = one.shapes.find((entry) => entry.id === id);

  if (shape === undefined) {
    throw new Error(`the board has no ${id}`);
  }

  return shape;
};

const leftOf = (one: Board, id: string): number =>
  shapeBounds(shapeOf(one, id), one.shapes).x;

describe('aligning a selection', () => {
  it('puts every shape flush to the selection box on the left', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 40, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 120 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.align('left');

    expect(leftOf(editor.getBoard(), 'a')).toBe(40);
    expect(leftOf(editor.getBoard(), 'b')).toBe(40);
  });

  it('writes nothing when every shape is already where the alignment would put it', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 40, y: 0 }),
        rectangle({ id: 'b', x: 40, y: 120 }),
      ])
    );
    const before = editor.getBoard();
    editor.setSelection(['a', 'b']);

    editor.align('left');

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('is one history entry however many shapes move, so one undo puts them all back', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 120 }),
        rectangle({ id: 'c', x: 400, y: 240 }),
      ])
    );
    const before = editor.getBoard();
    editor.setSelection(['a', 'b', 'c']);

    editor.align('left');
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: true });

    editor.undo();
    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: true, canUndo: false });
  });

  it('aligns a connector-bound pair without moving the connector itself', () => {
    const joined = connector();
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 40, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 120 }),
        joined,
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.align('left');

    expect(shapeOf(editor.getBoard(), 'connector-1')).toEqual(joined);
  });

  it('puts every shape flush to the right edge', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 120 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.align('right');

    expect(shapeOf(editor.getBoard(), 'a')).toMatchObject({ x: 200 });
    expect(shapeOf(editor.getBoard(), 'b')).toMatchObject({ x: 200 });
  });

  it('centres every shape horizontally on the selection box', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 120 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.align('center-horizontal');

    expect(shapeOf(editor.getBoard(), 'a')).toMatchObject({ x: 100 });
    expect(shapeOf(editor.getBoard(), 'b')).toMatchObject({ x: 100 });
  });

  it('puts every shape flush to the top edge', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ h: 40, id: 'b', x: 200, y: 120 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.align('top');

    expect(shapeOf(editor.getBoard(), 'b')).toMatchObject({ y: 0 });
  });

  it('puts every shape flush to the bottom edge', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ h: 40, id: 'b', x: 200, y: 120 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.align('bottom');

    expect(shapeOf(editor.getBoard(), 'a')).toMatchObject({ y: 100 });
    expect(shapeOf(editor.getBoard(), 'b')).toMatchObject({ y: 120 });
  });

  it('centres every shape vertically on the selection box', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ h: 40, id: 'b', x: 200, y: 120 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.align('center-vertical');

    expect(shapeOf(editor.getBoard(), 'a')).toMatchObject({ y: 50 });
    expect(shapeOf(editor.getBoard(), 'b')).toMatchObject({ y: 60 });
  });
});

describe('distributing a selection', () => {
  it('spaces three shapes with equal gaps along the horizontal axis', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 150, y: 0 }),
        rectangle({ id: 'c', x: 500, y: 0 }),
      ])
    );
    editor.setSelection(['a', 'b', 'c']);

    editor.distribute('x');

    const after = editor.getBoard();
    expect(shapeOf(after, 'a')).toMatchObject({ x: 0 });
    expect(shapeOf(after, 'b')).toMatchObject({ x: 250 });
    expect(shapeOf(after, 'c')).toMatchObject({ x: 500 });
  });

  it('spaces three shapes with equal gaps along the vertical axis', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 0, y: 100 }),
        rectangle({ id: 'c', x: 0, y: 400 }),
      ])
    );
    editor.setSelection(['a', 'b', 'c']);

    editor.distribute('y');

    const after = editor.getBoard();
    expect(shapeOf(after, 'a')).toMatchObject({ y: 0 });
    expect(shapeOf(after, 'b')).toMatchObject({ y: 200 });
    expect(shapeOf(after, 'c')).toMatchObject({ y: 400 });
  });

  it('writes nothing when the gaps already match', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 250, y: 0 }),
        rectangle({ id: 'c', x: 500, y: 0 }),
      ])
    );
    const before = editor.getBoard();
    editor.setSelection(['a', 'b', 'c']);

    editor.distribute('x');

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('is one history entry, so one undo puts every shape back', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 150, y: 0 }),
        rectangle({ id: 'c', x: 500, y: 0 }),
      ])
    );
    const before = editor.getBoard();
    editor.setSelection(['a', 'b', 'c']);

    editor.distribute('x');
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: true });

    editor.undo();
    expect(editor.getBoard()).toBe(before);
  });

  it('does nothing with fewer than three shapes to space', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 150, y: 0 }),
      ])
    );
    const before = editor.getBoard();
    editor.setSelection(['a', 'b']);

    editor.distribute('x');

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });
});

describe('arranging a group', () => {
  const grouped = () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 250, y: 40 }),
        rectangle({ id: 'c', x: 500, y: 200 }),
      ])
    );
    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    return editor;
  };

  it('aligns the box its members derive, not the stand-in stored on the group', () => {
    const editor = grouped();
    const group = editor.getSelection()[0] ?? '';
    const stored = shapeOf(editor.getBoard(), group);

    editor.setSelection([group, 'c']);
    editor.align('right');

    const after = editor.getBoard();
    expect(shapeOf(after, 'a')).toMatchObject({ x: 250 });
    expect(shapeOf(after, 'b')).toMatchObject({ x: 500 });
    expect(shapeOf(after, group)).toEqual(stored);
    expect(shapeBounds(shapeOf(after, group), after.shapes)).toEqual({
      h: 100,
      w: 350,
      x: 250,
      y: 0,
    });
  });

  it('keeps a locked member, and the group with it, where they are', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', locked: true, x: 250, y: 40 }),
        rectangle({ id: 'c', x: 600, y: 200 }),
      ])
    );
    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    const group = editor.getSelection()[0] ?? '';
    const before = editor.getBoard();

    editor.setSelection([group, 'c']);
    editor.align('right');

    expect(editor.getBoard()).toBe(before);
  });
});

describe('a locked shape in an alignment', () => {
  it('stays put while an unlocked neighbour aligns to the box', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'locked', locked: true, x: 0, y: 0 }),
        rectangle({ id: 'free', x: 200, y: 120 }),
      ])
    );
    editor.setSelection(['locked', 'free']);

    editor.align('right');

    expect(shapeOf(editor.getBoard(), 'locked')).toMatchObject({ x: 0 });
    expect(shapeOf(editor.getBoard(), 'free')).toMatchObject({ x: 200 });
  });

  it('writes nothing when the locked shape is the only one that would move', () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'locked', locked: true, x: 200, y: 0 }),
        rectangle({ id: 'free', x: 0, y: 120 }),
      ])
    );
    const before = editor.getBoard();
    editor.setSelection(['locked', 'free']);

    editor.align('left');

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });
});

describe('a connector between aligned shapes', () => {
  it('re-routes because its bound ends follow the shapes that moved', () => {
    const joined = connector({
      from: {
        anchor: { edge: 'right', fraction: 0.5 },
        kind: 'bound',
        shapeId: 'a',
      },
      to: {
        anchor: { edge: 'left', fraction: 0.5 },
        kind: 'bound',
        shapeId: 'b',
      },
    });
    const editor = createEditor(
      board([
        rectangle({ id: 'a', x: 0, y: 0 }),
        rectangle({ id: 'b', x: 200, y: 200 }),
        joined,
      ])
    );
    const line = (one: Board): string => {
      const shape = shapeOf(one, 'connector-1');
      if (shape.kind !== 'connector') {
        throw new Error('the connector is not a connector');
      }
      return connectorInk(shape, one.shapes)[0]?.d ?? '';
    };

    expect(line(editor.getBoard())).toBe('M 100 30 L 200 230');
    editor.setSelection(['a', 'b']);

    editor.align('top');

    expect(line(editor.getBoard())).toBe('M 100 30 L 200 30');
  });
});
