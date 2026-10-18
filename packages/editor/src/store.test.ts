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
