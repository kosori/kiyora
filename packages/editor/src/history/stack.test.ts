import { createHistory } from '@kiyora/editor';
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

describe('the history', () => {
  it('has nothing to undo or redo when it opens', () => {
    const history = createHistory();

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.getState()).toEqual({ canRedo: false, canUndo: false });
  });

  it('records the board a gesture started from, and restores it on undo', () => {
    const history = createHistory();
    const first = board('First');
    const second = board('Second');

    history.commit(first);

    expect(history.canUndo()).toBe(true);
    expect(history.undo(second)).toBe(first);
    expect(history.canUndo()).toBe(false);
  });

  it('redoes what undo took away, in order', () => {
    const history = createHistory();
    const first = board('First');
    const second = board('Second');
    const third = board('Third');

    history.commit(first);
    history.commit(second);
    history.undo(third);

    expect(history.canRedo()).toBe(true);
    expect(history.redo(second)).toBe(third);
    expect(history.canRedo()).toBe(false);
  });

  it('clears the redo stack when a new gesture commits, so redo never surprises', () => {
    const history = createHistory();

    history.commit(board('First'));
    history.undo(board('Second'));

    expect(history.canRedo()).toBe(true);

    history.commit(board('Third'));

    expect(history.canRedo()).toBe(false);
  });

  it('drops the oldest entry once it is at its bound', () => {
    const history = createHistory(2);
    const second = board('Second');
    const third = board('Third');

    history.commit(board('First'));
    history.commit(second);
    history.commit(third);

    expect(history.depth()).toBe(2);
    expect(history.undo(board('Fourth'))).toBe(third);
    expect(history.undo(third)).toBe(second);
  });

  it('notifies a subscriber whenever a commit changes what is possible', () => {
    const history = createHistory();
    const seen: boolean[] = [];
    history.subscribe(() => seen.push(history.canUndo()));

    history.commit(board('First'));

    expect(seen).toEqual([true]);
  });

  it('forgets everything when it is cleared, so a new board opens with a clean slate', () => {
    const history = createHistory();
    history.commit(board('First'));
    history.undo(board('Second'));

    history.clear();

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.depth()).toBe(0);
  });
});
