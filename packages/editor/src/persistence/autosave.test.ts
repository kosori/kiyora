import {
  type BoardStorage,
  createAutosave,
  createEditor,
} from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

/** A storage that records every byte it is handed, standing in for IndexedDB. */
const memoryStorage = () => {
  let held: string | null = null;
  const writes: string[] = [];

  const storage: BoardStorage = {
    read: () => Promise.resolve(held),
    write: (value) => {
      writes.push(value);
      held = value;
      return Promise.resolve();
    },
  };

  return { storage, writes };
};

const readBack = (value: string | undefined): Board =>
  parseBoard(JSON.parse(value ?? 'null'));

afterEach(() => {
  vi.useRealTimers();
});

describe('autosave', () => {
  it('writes the board a short moment after the last change', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    const { storage, writes } = memoryStorage();
    createAutosave({ delay: 50, editor, storage });

    editor.setBoard(board('Second'));
    await vi.advanceTimersByTimeAsync(49);

    expect(writes).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);

    expect(writes).toHaveLength(1);
    expect(readBack(writes.at(0)).title).toBe('Second');
  });

  it('collapses a burst of changes into one write', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    const { storage, writes } = memoryStorage();
    createAutosave({ delay: 50, editor, storage });

    editor.setBoard(board('Second'));
    editor.setBoard(board('Third'));
    editor.setBoard(board('Fourth'));
    await vi.advanceTimersByTimeAsync(50);

    expect(writes).toHaveLength(1);
    expect(readBack(writes.at(0)).title).toBe('Fourth');
  });

  it('flushes at once, so a closing tab does not lose the last change', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({ delay: 50, editor, storage });

    editor.setBoard(board('Second'));
    await autosave.flush();

    expect(readBack(writes.at(0)).title).toBe('Second');
  });

  it('writes the view camera into the board, not the stale camera on the board', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First', { x: 5, y: 5, zoom: 1 }));
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({ delay: 50, editor, storage });

    editor.setCamera({ x: 40, y: -12, zoom: 2.5 });
    await autosave.flush();

    expect(readBack(writes.at(0)).camera).toEqual({ x: 40, y: -12, zoom: 2.5 });
  });

  it('says unsaved while the change is pending, then saved once written', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    const { storage } = memoryStorage();
    const autosave = createAutosave({ delay: 50, editor, storage });

    expect(autosave.getStatus()).toBe('saved');

    editor.setBoard(board('Second'));

    expect(autosave.getStatus()).toBe('unsaved');

    await vi.advanceTimersByTimeAsync(50);

    expect(autosave.getStatus()).toBe('saved');
  });

  it('publishes the status change to its subscribers', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    const { storage } = memoryStorage();
    const autosave = createAutosave({ delay: 50, editor, storage });
    const seen: string[] = [];
    autosave.subscribe(() => seen.push(autosave.getStatus()));

    editor.setBoard(board('Second'));
    await vi.advanceTimersByTimeAsync(50);

    expect(seen).toContain('saving');
    expect(seen.at(-1)).toBe('saved');
  });

  it('stays unsaved when the write fails, and saves once a later write lands', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    let held: string | null = null;
    let accept: (value: string) => Promise<void> = () =>
      Promise.reject(new Error('quota'));
    const storage: BoardStorage = {
      read: () => Promise.resolve(held),
      write: (value) => accept(value),
    };
    const autosave = createAutosave({ delay: 50, editor, storage });

    editor.setBoard(board('Second'));
    await vi.advanceTimersByTimeAsync(50);

    expect(autosave.getStatus()).toBe('unsaved');

    accept = (value) => {
      held = value;
      return Promise.resolve();
    };
    editor.setBoard(board('Third'));
    await vi.advanceTimersByTimeAsync(50);

    expect(autosave.getStatus()).toBe('saved');
  });

  it('stops writing once it is stopped', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({ delay: 50, editor, storage });

    autosave.stop();
    editor.setBoard(board('Second'));
    await vi.advanceTimersByTimeAsync(100);

    expect(writes).toEqual([]);
  });
});
