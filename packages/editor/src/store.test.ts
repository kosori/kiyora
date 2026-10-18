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
      tool: 'select',
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
