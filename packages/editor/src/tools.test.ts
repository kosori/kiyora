import { createEditor, type Tool } from '@kiyora/editor';
import {
  type Board,
  type FigureKind,
  parseBoard,
  SCHEMA_VERSION,
  type Style,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (shapes: Board['shapes'] = []): Board =>
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

/** A gesture that never moved: a click at one point. */
const click = (x: number, y: number) => ({ from: { x, y }, to: { x, y } });

const red: Style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'red',
  fillStyle: 'bold',
  stroke: 'red',
  strokeWidth: 4,
};

describe('the tools', () => {
  it('starts on select, so an accidental drag does not draw', () => {
    expect(createEditor(board()).getTool()).toBe('select');
  });

  it('publishes the active tool to every view subscriber', () => {
    const editor = createEditor(board());
    const seen: Tool[] = [];
    editor.subscribeView(() => seen.push(editor.getTool()));

    editor.setTool('rectangle');

    expect(seen).toEqual(['rectangle']);
  });

  it('places a default-sized rectangle where a click landed', () => {
    const editor = createEditor(board());
    editor.setTool('rectangle');

    editor.placeShape(click(400, 300));

    expect(editor.getBoard().shapes.at(-1)).toMatchObject({
      h: 100,
      kind: 'rectangle',
      w: 160,
      x: 320,
      y: 250,
    });
  });

  it('places a rectangle the size of the drag', () => {
    const editor = createEditor(board());
    editor.setTool('rectangle');

    editor.placeShape({ from: { x: 200, y: 150 }, to: { x: 400, y: 300 } });

    expect(editor.getBoard().shapes.at(-1)).toMatchObject({
      h: 150,
      w: 200,
      x: 200,
      y: 150,
    });
  });

  it('lands the shape where the gesture ended, whichever way it was dragged', () => {
    const editor = createEditor(board());
    editor.setTool('rectangle');

    editor.placeShape({ from: { x: 400, y: 300 }, to: { x: 200, y: 150 } });

    expect(editor.getBoard().shapes.at(-1)).toMatchObject({
      h: 150,
      w: 200,
      x: 200,
      y: 150,
    });
  });

  it('returns to select after placing, so a second drag does not draw', () => {
    const editor = createEditor(board());
    editor.setTool('rectangle');
    editor.placeShape(click(400, 300));

    const afterOne = editor.getBoard();

    expect(editor.getTool()).toBe('select');

    editor.placeShape(click(100, 100));

    expect(editor.getBoard()).toBe(afterOne);
  });

  it('places nothing with the hand tool, so panning cannot draw', () => {
    const editor = createEditor(board());
    editor.setTool('hand');

    const before = editor.getBoard();

    editor.placeShape(click(400, 300));

    expect(editor.getBoard()).toBe(before);
  });

  it('publishes a placed shape to every subscriber', () => {
    const editor = createEditor(board());
    editor.setTool('rectangle');
    const seen: number[] = [];
    editor.subscribe(() => seen.push(editor.getBoard().shapes.length));

    editor.placeShape(click(400, 300));

    expect(seen).toEqual([1]);
  });

  it('wears the last used style on every shape it places', () => {
    const editor = createEditor(board());
    editor.setStyle(red);

    editor.setTool('rectangle');
    editor.placeShape(click(400, 300));
    editor.setTool('rectangle');
    editor.placeShape(click(600, 300));

    for (const shape of editor.getBoard().shapes) {
      expect(shape.style).toEqual(red);
    }
  });

  it('reads back the last used style, so the picker has one source for its default', () => {
    const editor = createEditor(board());
    editor.setStyle(red);

    expect(editor.getStyle()).toEqual(red);
  });

  it('gives each shape an id the board does not already hold', () => {
    const editor = createEditor(
      board([
        {
          h: 100,
          id: 'rectangle-1',
          kind: 'rectangle',
          locked: false,
          opacity: 1,
          parentId: null,
          rotation: 0,
          style: red,
          w: 160,
          x: 0,
          y: 0,
        },
      ])
    );
    editor.setTool('rectangle');

    editor.placeShape(click(400, 300));

    expect(editor.getBoard().shapes.at(-1)?.id).toBe('rectangle-2');
  });
});

const CONTROLS: readonly FigureKind[] = [
  'avatar',
  'badge',
  'breadcrumb',
  'button',
  'card',
  'checkbox',
  'divider',
  'dropdown',
  'input',
  'pagination',
  'radio',
  'slider',
  'table',
  'tabs',
  'text-area',
  'toggle',
];

describe('placing a wireframe control', () => {
  it.each(CONTROLS)(
    'places %s from its tool, on the one figure placement path',
    (kind) => {
      const editor = createEditor(board());
      editor.setTool(kind);

      editor.placeShape(click(400, 300));

      expect(editor.getBoard().shapes.at(-1)).toMatchObject({
        h: 100,
        kind,
        w: 160,
        x: 320,
        y: 250,
      });
    }
  );
});
