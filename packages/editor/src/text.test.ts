import { createEditor, isFigureTool, isShapeTool } from '@kiyora/editor';
import {
  type Board,
  DEFAULT_TEXT_STYLE,
  parseBoard,
  SCHEMA_VERSION,
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

const click = (x: number, y: number) => ({ from: { x, y }, to: { x, y } });

describe('the tools that place a shape', () => {
  it('places a text shape as well as a figure', () => {
    expect(isShapeTool('text')).toBe(true);
    expect(isShapeTool('rectangle')).toBe(true);
    expect(isFigureTool('text')).toBe(false);
    expect(isFigureTool('rectangle')).toBe(true);
    expect(isShapeTool('select')).toBe(false);
    expect(isShapeTool('hand')).toBe(false);
  });
});

describe('placing a text shape', () => {
  it('places an empty text shape wearing the default text style, and returns it', () => {
    const editor = createEditor(board());
    editor.setTool('text');

    const placed = editor.placeShape(click(400, 300));

    expect(placed).toMatchObject({
      kind: 'text',
      text: '',
      textStyle: DEFAULT_TEXT_STYLE,
    });
    expect(editor.getBoard().shapes.at(-1)).toBe(placed);
    expect(editor.getTool()).toBe('select');
  });

  it('gives a text shape its own id series', () => {
    const editor = createEditor(board());
    editor.setTool('text');
    editor.placeShape(click(100, 100));
    editor.setTool('text');
    editor.placeShape(click(200, 200));

    expect(editor.getBoard().shapes.map((shape) => shape.id)).toEqual([
      'text-1',
      'text-2',
    ]);
  });

  it('returns nothing for a tool that places no shape', () => {
    const editor = createEditor(board());
    expect(editor.placeShape(click(400, 300))).toBeNull();
  });
});

describe('editing a label', () => {
  const withRectangle = () =>
    createEditor(
      board([
        {
          h: 100,
          id: 'rectangle-1',
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
          x: 0,
          y: 0,
        },
      ])
    );

  it('sets a shape label and publishes it once', () => {
    const editor = withRectangle();
    let published = 0;
    editor.subscribe(() => {
      published += 1;
    });

    editor.setText('rectangle-1', 'Plan');

    expect(editor.getBoard().shapes[0]?.text).toBe('Plan');
    expect(published).toBe(1);
  });

  it('does not publish when the label is unchanged, so a commit that changes nothing is free', () => {
    const editor = withRectangle();
    editor.setText('rectangle-1', 'Plan');
    const after = editor.getBoard();
    let published = 0;
    editor.subscribe(() => {
      published += 1;
    });

    editor.setText('rectangle-1', 'Plan');

    expect(editor.getBoard()).toBe(after);
    expect(published).toBe(0);
  });

  it('sets the text style of a shape', () => {
    const editor = withRectangle();

    editor.setTextStyle('rectangle-1', {
      align: 'right',
      size: 32,
      valign: 'top',
    });

    expect(editor.getBoard().shapes[0]?.textStyle).toEqual({
      align: 'right',
      size: 32,
      valign: 'top',
    });
  });
});
