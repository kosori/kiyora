import { createEditor, DEFAULT_STYLE } from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const rectangle = (id: string, x: number): Board['shapes'][number] => ({
  h: 100,
  id,
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'blue',
    fillStyle: 'pastel',
    stroke: 'ink',
    strokeWidth: 2,
  },
  w: 160,
  x,
  y: 0,
});

const board = (shapes: Board['shapes']): Board =>
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

const twoShapes = (): Board =>
  board([rectangle('one', 0), rectangle('two', 200)]);

describe('styling the selection\u2019s text', () => {
  it('sets the text size on every selected shape in one board change', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['one', 'two']);
    const seen: Board[] = [];
    editor.subscribe(() => seen.push(editor.getBoard()));

    editor.restyle({ textStyle: { size: 32 } });

    expect(seen).toHaveLength(1);
    expect(editor.getBoard().shapes.map((one) => one.textStyle?.size)).toEqual([
      32, 32,
    ]);
  });

  it('aligns the text horizontally, and a shape label vertically', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['one']);

    editor.restyle({ textStyle: { align: 'right', valign: 'bottom' } });

    expect(editor.getBoard().shapes[0]?.textStyle).toMatchObject({
      align: 'right',
      valign: 'bottom',
    });
  });

  it('leaves the style the next shape wears alone, because text is not the palette', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['one']);

    editor.restyle({ textStyle: { size: 32 } });
    editor.setTool('rectangle');
    editor.placeShape({ from: { x: 400, y: 400 }, to: { x: 400, y: 400 } });

    expect(editor.getBoard().shapes.at(-1)?.style).toEqual(DEFAULT_STYLE);
  });

  it('records the change as one entry, so one undo walks it back', () => {
    const editor = createEditor(twoShapes());
    const original = editor.getBoard();
    editor.setSelection(['one', 'two']);

    editor.restyle({ textStyle: { size: 32 } });
    editor.undo();

    expect(editor.getBoard()).toBe(original);
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('still records a shape style change as one entry when it carries text too', () => {
    const editor = createEditor(twoShapes());
    editor.setSelection(['one']);

    editor.restyle({ style: { fill: 'red' }, textStyle: { size: 12 } });

    expect(editor.getBoard().shapes[0]).toMatchObject({
      style: { fill: 'red' },
      textStyle: { size: 12 },
    });
    expect(editor.getStyle().fill).toBe('red');
  });
});
