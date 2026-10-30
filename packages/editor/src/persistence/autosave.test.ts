import {
  type BoardStorage,
  createAutosave,
  createEditor,
  type Presence,
  StorageError,
} from '@kiyora/editor';
import {
  type Board,
  parseBoard,
  parseBoardFile,
  SCHEMA_VERSION,
  serializeBoard,
} from '@kiyora/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

const board = (
  title: string,
  camera = { x: 0, y: 0, zoom: 1 },
  overrides: Record<string, unknown> = {}
): Board =>
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
    ...overrides,
  });

/** A storage that records every byte it is handed, standing in for IndexedDB. */
const memoryStorage = () => {
  let held: string | null = null;
  const writes: string[] = [];

  const storage: BoardStorage = {
    quarantine: () => Promise.resolve(),
    read: () => Promise.resolve(held),
    snapshot: () => Promise.resolve(),
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

/** A presence whose primacy a test can flip, standing in for the tab handshake. */
const presenceAt = () => {
  let primary = true;
  const listeners = new Set<() => void>();
  const presence: Presence = {
    isPrimary: () => primary,
    leader: () => null,
    leave: () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const setPrimary = (next: boolean): void => {
    primary = next;
    for (const listener of listeners) {
      listener();
    }
  };
  return { presence, setPrimary };
};

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

  it('does not arm a write for a pan alone, so navigating is free', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First', { x: 5, y: 5, zoom: 1 }));
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({ delay: 50, editor, storage });

    editor.setCamera({ x: 40, y: -12, zoom: 2.5 });
    await vi.advanceTimersByTimeAsync(50);

    expect(writes).toEqual([]);
    expect(autosave.getStatus()).toBe('saved');
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
      quarantine: () => Promise.resolve(),
      read: () => Promise.resolve(held),
      snapshot: () => Promise.resolve(),
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

  it('records the typed fault behind a failed write and clears it once one lands', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    let accept: () => Promise<void> = () =>
      Promise.reject(new StorageError({ kind: 'quota' }));
    const storage: BoardStorage = {
      quarantine: () => Promise.resolve(),
      read: () => Promise.resolve(null),
      snapshot: () => Promise.resolve(),
      write: () => accept(),
    };
    const autosave = createAutosave({ delay: 50, editor, storage });

    editor.setBoard(board('Second'));
    await vi.advanceTimersByTimeAsync(50);

    expect(autosave.getFault()).toEqual({ kind: 'quota' });
    expect(autosave.getStatus()).toBe('unsaved');

    accept = () => Promise.resolve();
    editor.setBoard(board('Third'));
    await vi.advanceTimersByTimeAsync(50);

    expect(autosave.getFault()).toBeNull();
  });

  it('writes nothing while another tab holds the board, then takes over', async () => {
    vi.useFakeTimers();
    const editor = createEditor(board('First'));
    const { storage, writes } = memoryStorage();
    const { presence, setPrimary } = presenceAt();
    createAutosave({ delay: 50, editor, presence, storage });

    setPrimary(false);
    editor.setBoard(board('Second'));
    await vi.advanceTimersByTimeAsync(50);

    expect(writes).toEqual([]);

    setPrimary(true);
    await vi.advanceTimersByTimeAsync(50);

    expect(writes).toHaveLength(1);
    expect(readBack(writes.at(0)).title).toBe('Second');
  });
});

describe('what autosave stores', () => {
  it('is a board file, so the store and the file hold one shape', async () => {
    vi.useFakeTimers();
    const saved = board('Stored', { x: 3, y: 4, zoom: 2 });
    const editor = createEditor(saved);
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({
      delay: 50,
      editor,
      now: () => saved.updatedAt,
      storage,
    });

    await autosave.flush();

    expect(parseBoardFile(writes.at(0) ?? '')).toEqual(saved);
  });

  it('serialises through the board file, not a second path of its own', async () => {
    vi.useFakeTimers();
    const scrambled: Board = {
      camera: { x: 0, y: 0, zoom: 1 },
      createdAt: 1_700_000_000_000,
      deck: [],
      files: {},
      id: 'board-1',
      schemaVersion: SCHEMA_VERSION,
      settings: { theme: 'light' },
      shapes: [],
      title: 'Scrambled',
      updatedAt: 1_700_000_000_000,
    };
    const editor = createEditor(scrambled);
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({
      delay: 50,
      editor,
      now: () => scrambled.updatedAt,
      storage,
    });

    await autosave.flush();

    expect(writes.at(0)).toBe(serializeBoard(scrambled));
  });
});

describe('the save time', () => {
  it('is stamped at write time, never into the board the editor holds', async () => {
    const opened = board('First');
    const editor = createEditor(opened);
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({
      editor,
      now: () => 42,
      storage,
    });

    await autosave.flush();

    expect(readBack(writes.at(0)).updatedAt).toBe(42);
    expect(editor.getBoard().updatedAt).toBe(opened.updatedAt);
  });

  it('moves forward after an undo, so undo never puts an older time back', async () => {
    const opened = board('First');
    const editor = createEditor(opened);
    const { storage, writes } = memoryStorage();
    let clock = 2000;
    const autosave = createAutosave({
      editor,
      now: () => clock,
      storage,
    });

    editor.setTheme('dark');
    await autosave.flush();
    expect(readBack(writes.at(0)).updatedAt).toBe(2000);

    editor.undo();
    expect(editor.getBoard().updatedAt).toBe(opened.updatedAt);

    clock = 3000;
    await autosave.flush();

    expect(readBack(writes.at(-1)).updatedAt).toBe(3000);
  });
});

describe('a store that cannot hold images', () => {
  const IMAGE = {
    bytes: 68,
    dataURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    mime: 'image/png' as const,
  };

  const withImage = (): Board =>
    board('Pictures', undefined, {
      files: { hash: IMAGE },
      shapes: [
        {
          fileId: 'hash',
          h: 90,
          id: 'image-1',
          kind: 'image',
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
      ],
    });

  it('refuses the write with an images fault instead of dropping the payload', async () => {
    vi.useFakeTimers();
    const editor = createEditor(withImage());
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({
      delay: 50,
      editor,
      storage: { ...storage, supportsFiles: false },
    });

    editor.setBoard({ ...withImage(), title: 'Changed' });
    await vi.advanceTimersByTimeAsync(50);

    expect(writes).toEqual([]);
    expect(autosave.getFault()).toEqual({ kind: 'images' });
    expect(autosave.getStatus()).toBe('unsaved');
  });

  it('writes again, clearing the fault, once the board carries no image', async () => {
    vi.useFakeTimers();
    const editor = createEditor(withImage());
    const { storage, writes } = memoryStorage();
    const autosave = createAutosave({
      delay: 50,
      editor,
      storage: { ...storage, supportsFiles: false },
    });

    editor.setBoard({ ...withImage(), title: 'Changed' });
    await vi.advanceTimersByTimeAsync(50);
    editor.setBoard(board('Clean'));
    await vi.advanceTimersByTimeAsync(50);

    expect(readBack(writes.at(0)).title).toBe('Clean');
    expect(autosave.getFault()).toBeNull();
    expect(autosave.getStatus()).toBe('saved');
  });
});
