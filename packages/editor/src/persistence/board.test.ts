import {
  type BoardStorage,
  createEditor,
  loadBoard,
  restoreBoard,
} from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (title: string, camera = { x: 0, y: 0, zoom: 1 }): Board =>
  parseBoard({
    camera,
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [],
    title,
    updatedAt: 1_700_000_000_000,
  });

const holding = (value: string | null): BoardStorage => ({
  read: () => Promise.resolve(value),
  write: () => Promise.resolve(),
});

describe('loading a board', () => {
  it('finds nothing when nothing was ever stored', async () => {
    expect(await loadBoard(holding(null))).toBeNull();
  });

  it('reads back the board it wrote', async () => {
    const stored = board('Kept', { x: 8, y: 9, zoom: 3 });

    expect(await loadBoard(holding(JSON.stringify(stored)))).toEqual(stored);
  });

  it('treats bytes that are not a board as nothing stored', async () => {
    expect(await loadBoard(holding('{"not":"a board"}'))).toBeNull();
    expect(await loadBoard(holding('truncated'))).toBeNull();
  });
});

describe('restoring a board', () => {
  it('opens the board where it was left, camera and all', () => {
    const editor = createEditor(board('First'));
    const stored = board('Second', { x: 12, y: -30, zoom: 0.5 });

    restoreBoard(editor, stored);

    expect(editor.getBoard()).toEqual(stored);
    expect(editor.getView().camera).toEqual({ x: 12, y: -30, zoom: 0.5 });
  });
});
