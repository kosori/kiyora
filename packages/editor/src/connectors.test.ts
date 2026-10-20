import { createEditor, NO_GESTURE_MODIFIERS } from '@kiyora/editor';
import {
  type Board,
  type ConnectorShape,
  connectorPath,
  type FigureShape,
  parseBoard,
  resolveConnector,
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

const twoShapes = (): Board =>
  board([rectangle({ id: 'a' }), rectangle({ id: 'b', x: 300 })]);

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

const connectorOf = (board: Board): ConnectorShape => {
  const shape = board.shapes.find((one) => one.kind === 'connector');
  if (shape === undefined) {
    throw new Error('no connector on the board');
  }
  return shape;
};

const lineOf = (board: Board): string =>
  connectorPath('straight', resolveConnector(connectorOf(board), board.shapes));

describe('drawing a connector', () => {
  it('binds each end to the shape the drag landed on', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');

    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });

    const connector = connectorOf(editor.getBoard());
    expect(connector.from).toEqual({ kind: 'bound', shapeId: 'a' });
    expect(connector.to).toEqual({ kind: 'bound', shapeId: 'b' });
  });

  it('stands an end free when the drag ended on empty canvas, so a target can come later', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');

    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 600, y: 30 } });

    const connector = connectorOf(editor.getBoard());
    expect(connector.from).toEqual({ kind: 'bound', shapeId: 'a' });
    expect(connector.to).toEqual({ kind: 'free', x: 600, y: 30 });
  });

  it('returns to select after placing, like every other shape tool', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');

    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });

    expect(editor.getTool()).toBe('select');
  });
});

describe('re-routing a bound connector', () => {
  it('follows the shape it is bound to with no separate repair pass', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });
    const before = lineOf(editor.getBoard());

    editor.setSelection(['b']);
    editor.nudge(0, 80);
    editor.endNudgeRun();

    const after = lineOf(editor.getBoard());
    expect(before).toBe('M 100 30 L 300 30');
    expect(after).not.toBe(before);
  });

  it('leaves a free end where it is when an unrelated shape moves', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 600, y: 30 } });

    editor.setSelection(['b']);
    editor.nudge(0, 80);
    editor.endNudgeRun();

    const ends = resolveConnector(
      connectorOf(editor.getBoard()),
      editor.getBoard().shapes
    );
    expect(ends.to.point).toEqual({ x: 600, y: 30 });
    expect(ends.from.point).toEqual({ x: 100, y: 30 });
  });
});

describe('choosing a connector’s route and heads', () => {
  it('changes them in one board write, so one change is one undo', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });

    editor.setConnector('connector-1', { end: 'circle', route: 'elbow' });

    expect(connectorOf(editor.getBoard())).toMatchObject({
      end: 'circle',
      route: 'elbow',
    });

    editor.undo();

    expect(connectorOf(editor.getBoard())).toMatchObject({
      end: 'arrow',
      route: 'straight',
    });
  });

  it('leaves the ends alone when only the route changes', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });

    editor.setConnector('connector-1', { route: 'curved' });

    const connector = connectorOf(editor.getBoard());
    expect(connector.route).toBe('curved');
    expect(connector.from).toEqual({ kind: 'bound', shapeId: 'a' });
    expect(connector.to).toEqual({ kind: 'bound', shapeId: 'b' });
  });
});

describe('fixing an end to an edge', () => {
  const joined = (): ReturnType<typeof createEditor> => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });
    return editor;
  };

  it('paints from the edge the author names instead of the one auto-picking chose', () => {
    const editor = joined();
    expect(lineOf(editor.getBoard())).toBe('M 100 30 L 300 30');

    editor.setConnector('connector-1', {
      fromAnchor: { edge: 'top', fraction: 0.5 },
    });

    expect(connectorOf(editor.getBoard()).from).toEqual({
      anchor: { edge: 'top', fraction: 0.5 },
      kind: 'bound',
      shapeId: 'a',
    });
    expect(lineOf(editor.getBoard())).toBe('M 50 0 L 300 30');
  });

  it('fixes either end, chosen independently', () => {
    const editor = joined();

    editor.setConnector('connector-1', {
      fromAnchor: { edge: 'top', fraction: 0.5 },
      toAnchor: { edge: 'bottom', fraction: 0.5 },
    });

    expect(lineOf(editor.getBoard())).toBe('M 50 0 L 350 60');
  });

  it('returns the end to auto-picking when no edge is chosen', () => {
    const editor = joined();
    editor.setConnector('connector-1', {
      fromAnchor: { edge: 'top', fraction: 0.5 },
    });
    expect(connectorOf(editor.getBoard()).from).toMatchObject({
      anchor: { edge: 'top', fraction: 0.5 },
    });

    editor.setConnector('connector-1', { fromAnchor: null });

    expect(connectorOf(editor.getBoard()).from).toEqual({
      kind: 'bound',
      shapeId: 'a',
    });
    expect(lineOf(editor.getBoard())).toBe('M 100 30 L 300 30');
  });

  it('keeps the fraction of the edge, so the attachment follows a resize and a move', () => {
    const editor = joined();
    editor.setConnector('connector-1', {
      fromAnchor: { edge: 'bottom', fraction: 0.25 },
    });
    expect(lineOf(editor.getBoard())).toBe('M 25 60 L 300 30');

    editor.setSelection(['a']);
    editor.pointerDown({ x: 100, y: 60 }, false);
    editor.pointerMove({ x: 160, y: 120 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();
    expect(lineOf(editor.getBoard())).toBe('M 40 120 L 300 60');

    editor.setSelection(['a']);
    editor.nudge(10, 0);
    editor.endNudgeRun();
    expect(lineOf(editor.getBoard())).toBe('M 50 120 L 300 60');
  });

  it('frees a fixed end where it attached when its shape is deleted', () => {
    const editor = joined();
    editor.setConnector('connector-1', {
      fromAnchor: { edge: 'bottom', fraction: 0.25 },
    });

    editor.setSelection(['a']);
    editor.deleteSelection();

    expect(connectorOf(editor.getBoard()).from).toEqual({
      kind: 'free',
      x: 25,
      y: 60,
    });
    expect(lineOf(editor.getBoard())).toBe('M 25 60 L 300 60');
  });
});

describe('deleting a shape its connector touches', () => {
  it('keeps the connector in a defined, visible state: the end is freed where it was', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });

    editor.setSelection(['b']);
    editor.deleteSelection();

    const board = editor.getBoard();
    expect(board.shapes.map((shape) => shape.id)).toEqual(['a', 'connector-1']);

    const connector = connectorOf(board);
    expect(connector.from).toEqual({ kind: 'bound', shapeId: 'a' });
    expect(connector.to).toEqual({ kind: 'free', x: 300, y: 30 });
    expect(lineOf(board)).toBe('M 100 30 L 300 30');
  });

  it('deletes the connector too when it is part of the selection', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');
    editor.placeShape({ from: { x: 50, y: 30 }, to: { x: 350, y: 30 } });

    editor.setSelection(['connector-1']);
    editor.deleteSelection();

    expect(editor.getBoard().shapes.map((shape) => shape.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('is one undoable gesture', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['b']);
    editor.deleteSelection();

    editor.undo();

    expect(editor.getBoard().shapes).toHaveLength(2);
  });
});

describe('moving a connector whose ends are free', () => {
  it('carries both free ends with it', () => {
    const editor = createEditor(twoShapes());
    editor.setTool('connector');
    editor.placeShape({ from: { x: 600, y: 60 }, to: { x: 700, y: 60 } });

    editor.setSelection(['connector-1']);
    editor.pointerDown({ x: 600, y: 60 }, false);
    editor.pointerMove({ x: 608, y: 68 }, NO_GESTURE_MODIFIERS);
    editor.pointerUp();

    const connector = connectorOf(editor.getBoard());
    expect(connector.from).toEqual({ kind: 'free', x: 608, y: 72 });
    expect(connector.to).toEqual({ kind: 'free', x: 708, y: 72 });
  });
});
