import {
  createEditor,
  type GestureModifiers,
  selectionBounds,
} from '@kiyora/editor';
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

const none: GestureModifiers = { bypassSnap: false, constrain: false };

const groupOf = (one: Board) => {
  const group = one.shapes.find((shape) => shape.kind === 'group');

  if (group === undefined) {
    throw new Error('the board has no group');
  }

  return group;
};

const pair = () =>
  board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 250, y: 40 })]);

describe('grouping a selection', () => {
  it('makes one group whose box is the box of its members', () => {
    const editor = createEditor(pair());
    editor.setSelection(['a', 'b']);

    editor.groupSelection();

    const after = editor.getBoard();
    const group = groupOf(after);

    expect(after.shapes.map((shape) => shape.id)).toEqual([group.id, 'a', 'b']);
    expect(after.shapes.map((shape) => shape.parentId)).toEqual([
      null,
      group.id,
      group.id,
    ]);
    expect(editor.getSelection()).toEqual([group.id]);
    expect(shapeBounds(group, after.shapes)).toEqual({
      h: 100,
      w: 350,
      x: 0,
      y: 0,
    });
  });

  it('is one history entry, so one undo puts the shapes back', () => {
    const editor = createEditor(pair());
    const before = editor.getBoard();
    editor.setSelection(['a', 'b']);

    editor.groupSelection();
    editor.undo();

    expect(editor.getBoard()).toBe(before);
  });

  it('does nothing when there is nothing to bring together', () => {
    const editor = createEditor(pair());
    editor.setSelection(['a']);

    editor.groupSelection();

    expect(editor.getBoard().shapes).toHaveLength(2);
  });
});

describe('moving a group', () => {
  const grouped = () => {
    const editor = createEditor(pair());
    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    return editor;
  };

  it('moves every member when one of them is dragged', () => {
    const editor = grouped();
    const stored = groupOf(editor.getBoard());

    editor.pointerDown({ x: 50, y: 30 }, false);
    editor.pointerMove({ x: 66, y: 46 }, none);
    editor.pointerUp();

    const after = editor.getBoard();
    expect(after.shapes.find((shape) => shape.id === 'a')).toMatchObject({
      x: 16,
      y: 16,
    });
    expect(after.shapes.find((shape) => shape.id === 'b')).toMatchObject({
      x: 266,
      y: 56,
    });
    expect(groupOf(after)).toEqual(stored);
  });

  it('keeps the derived box when a member is nudged', () => {
    const editor = grouped();
    const stored = groupOf(editor.getBoard());

    editor.setSelection([stored.id]);
    editor.nudge(8, 8);

    const after = editor.getBoard();
    expect(after.shapes.find((shape) => shape.id === 'a')).toMatchObject({
      x: 8,
      y: 8,
    });
    expect(groupOf(after)).toEqual(stored);
    expect(selectionBounds(after, [stored.id])).toEqual({
      h: 100,
      w: 350,
      x: 8,
      y: 8,
    });
  });
});

describe('resizing a group', () => {
  it('scales every member from the derived box', () => {
    const editor = createEditor(pair());
    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    const stored = groupOf(editor.getBoard());

    editor.pointerDown({ x: 350, y: 100 }, false);
    expect(editor.getGesture()).toEqual({
      guides: [],
      handle: 'se',
      kind: 'resize',
    });
    editor.pointerMove({ x: 1400, y: 400 }, none);
    editor.pointerUp();

    const after = editor.getBoard();
    expect(after.shapes.find((shape) => shape.id === 'a')).toMatchObject({
      h: 240,
      w: 400,
      x: 0,
      y: 0,
    });
    expect(after.shapes.find((shape) => shape.id === 'b')).toMatchObject({
      h: 240,
      w: 400,
      x: 1000,
      y: 160,
    });
    expect(groupOf(after)).toEqual(stored);
    expect(selectionBounds(after, [stored.id])).toEqual({
      h: 400,
      w: 1400,
      x: 0,
      y: 0,
    });
  });
});

describe('rotating a group', () => {
  it('turns every member about the derived centre', () => {
    const editor = createEditor(pair());
    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    const stored = groupOf(editor.getBoard());

    editor.pointerDown({ x: 175, y: -22 }, false);
    expect(editor.getGesture()).toEqual({ kind: 'rotate' });
    editor.pointerMove({ x: 350, y: 50 }, none);
    editor.pointerUp();

    const after = editor.getBoard();
    expect(after.shapes.find((shape) => shape.id === 'a')).toMatchObject({
      h: 60,
      rotation: 90,
      w: 100,
      x: 145,
      y: -105,
    });
    expect(after.shapes.find((shape) => shape.id === 'b')).toMatchObject({
      h: 60,
      rotation: 90,
      w: 100,
      x: 105,
      y: 145,
    });
    expect(groupOf(after)).toEqual(stored);
  });
});

describe('a group inside a group', () => {
  const nested = () => {
    const editor = createEditor(
      board([
        rectangle({ id: 'a' }),
        rectangle({ id: 'b', x: 250, y: 40 }),
        rectangle({ id: 'c', x: 500 }),
      ])
    );
    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    const inner = editor.getSelection()[0] ?? '';
    editor.setSelection([inner, 'c']);
    editor.groupSelection();
    return { editor, inner, outer: editor.getSelection()[0] ?? '' };
  };

  it('moves as one, and keeps the inner group intact', () => {
    const { editor, inner, outer } = nested();
    const before = editor.getBoard();

    expect(before.shapes.map((shape) => shape.id)).toEqual([
      outer,
      inner,
      'a',
      'b',
      'c',
    ]);
    expect(before.shapes.find((shape) => shape.id === inner)?.parentId).toBe(
      outer
    );
    expect(before.shapes.find((shape) => shape.id === 'c')?.parentId).toBe(
      outer
    );

    editor.pointerDown({ x: 50, y: 30 }, false);
    editor.pointerMove({ x: 66, y: 46 }, none);

    const after = editor.getBoard();
    for (const id of ['a', 'b', 'c']) {
      expect(after.shapes.find((shape) => shape.id === id)).toMatchObject({
        x: id === 'a' ? 16 : id === 'b' ? 266 : 516,
        y: id === 'b' ? 56 : 16,
      });
    }
  });

  it('puts the inner group back where it was when the outer is ungrouped', () => {
    const { editor, inner, outer } = nested();
    const before = editor.getBoard();

    editor.setSelection([outer]);
    editor.ungroupSelection();

    const after = editor.getBoard();
    expect(after.shapes.map((shape) => shape.id)).toEqual([
      inner,
      'a',
      'b',
      'c',
    ]);
    expect(after.shapes.find((shape) => shape.id === inner)?.parentId).toBe(
      null
    );
    expect(editor.getSelection()).toEqual([inner, 'c']);
    expect(after.shapes.find((shape) => shape.id === inner)).toEqual({
      ...before.shapes.find((shape) => shape.id === inner),
      parentId: null,
    });
  });
});

describe('ungrouping a selection', () => {
  it('leaves every member exactly where it was', () => {
    const editor = createEditor(pair());
    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    const before = editor.getBoard();

    editor.ungroupSelection();

    const after = editor.getBoard();
    expect(after.shapes.map((shape) => shape.id)).toEqual(['a', 'b']);
    expect(after.shapes.find((shape) => shape.id === 'a')).toEqual({
      ...before.shapes.find((shape) => shape.id === 'a'),
      parentId: null,
    });
    expect(after.shapes.find((shape) => shape.id === 'b')).toEqual({
      ...before.shapes.find((shape) => shape.id === 'b'),
      parentId: null,
    });
    expect(editor.getSelection()).toEqual(['a', 'b']);
  });

  it('is one history entry, so one undo brings the group back', () => {
    const editor = createEditor(pair());
    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    const grouped = editor.getBoard();

    editor.ungroupSelection();
    editor.undo();

    expect(editor.getBoard()).toBe(grouped);
  });
});

describe('grouping inside a frame', () => {
  it('keeps the group in the container its members shared', () => {
    const editor = createEditor(
      board([
        {
          ...rectangle({ h: 400, id: 'frame-1', w: 600, x: 100, y: 100 }),
          clip: true,
          kind: 'frame',
          variant: 'plain',
        },
        rectangle({ id: 'a', parentId: 'frame-1', x: 150, y: 150 }),
        rectangle({ id: 'b', parentId: 'frame-1', x: 350, y: 150 }),
      ])
    );
    editor.setSelection(['a', 'b']);

    editor.groupSelection();

    const group = groupOf(editor.getBoard());
    expect(group.parentId).toBe('frame-1');
    expect(editor.getBoard().shapes.map((shape) => shape.id)).toEqual([
      'frame-1',
      group.id,
      'a',
      'b',
    ]);
  });
});

describe('a connector bound to a member', () => {
  it('still paints and re-routes after the member is grouped and moved', () => {
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
        rectangle({ id: 'a' }),
        rectangle({ id: 'b', x: 250, y: 40 }),
        joined,
      ])
    );
    const line = (one: Board): string => {
      const shape = one.shapes.find((entry) => entry.kind === 'connector');
      if (shape === undefined || shape.kind !== 'connector') {
        throw new Error('the board has no connector');
      }
      return connectorInk(shape, one.shapes)[0]?.d ?? '';
    };

    expect(line(editor.getBoard())).toBe('M 100 30 L 250 70');

    editor.setSelection(['a', 'b']);
    editor.groupSelection();
    editor.pointerDown({ x: 50, y: 30 }, false);
    editor.pointerMove({ x: 66, y: 46 }, none);
    editor.pointerUp();

    expect(line(editor.getBoard())).toBe('M 116 46 L 266 86');
  });
});
