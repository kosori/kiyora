import {
  boardKey,
  boardQuarantineKey,
  createAutosave,
  createEditor,
  createLibrary,
  type KeyValueStore,
  LIBRARY_KEY,
} from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (
  id: string,
  title: string,
  updatedAt = 1_700_000_000_000,
  shapes: Board['shapes'] = []
): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_600_000_000_000,
    deck: [],
    id,
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title,
    updatedAt,
  });

const rectangle = {
  h: 80,
  id: 'rectangle',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'green',
    fillStyle: 'bold',
    stroke: 'green',
    strokeWidth: 2,
  },
  w: 120,
  x: 0,
  y: 0,
} as const;

/** A store that records what it holds, standing in for IndexedDB. */
const memoryStore = (seed: Record<string, string> = {}) => {
  const held = new Map(Object.entries(seed));
  const store: KeyValueStore = {
    delete: (key) => {
      held.delete(key);
      return Promise.resolve();
    },
    get: (key) => Promise.resolve(held.get(key) ?? null),
    keys: () => Promise.resolve([...held.keys()]),
    put: (key, value) => {
      held.set(key, value);
      return Promise.resolve();
    },
  };

  return { held, store };
};

const recordOf = (held: Map<string, string>) =>
  JSON.parse(held.get(LIBRARY_KEY) ?? 'null') as {
    boards: { id: string; title: string; updatedAt: number }[];
    version: number;
  };

describe('the library', () => {
  it('lists every board newest change first, without opening a payload', async () => {
    const older = board('older', 'Older', 10);
    const newer = board('newer', 'Newer', 20);
    const { held, store } = memoryStore();
    const library = createLibrary(store);

    await library.create(older);
    await library.create(newer);

    const entries = await library.entries();

    expect(entries.map(({ id }) => id)).toEqual(['newer', 'older']);
    expect(entries.map(({ title }) => title)).toEqual(['Newer', 'Older']);
    expect(recordOf(held).boards.map(({ id }) => id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('rebuilds a lost record from the board keys', async () => {
    const first = board('first', 'First', 10, [rectangle]);
    const second = board('second', 'Second', 20);
    const { held, store } = memoryStore();
    const library = createLibrary(store);
    await library.create(first);
    await library.create(second);

    held.delete(LIBRARY_KEY);

    expect((await library.entries()).map(({ id }) => id)).toEqual([
      'second',
      'first',
    ]);
    expect(recordOf(held).boards).toHaveLength(2);
  });

  it('quarantines one unreadable payload and keeps the rest of the library', async () => {
    const good = board('good', 'Good');
    const { held, store } = memoryStore();
    const library = createLibrary(store);
    await library.create(good);

    held.set(boardKey('broken'), 'this is not a board');
    held.delete(LIBRARY_KEY);

    expect((await library.entries()).map(({ id }) => id)).toEqual(['good']);
    expect(held.get(boardKey('broken'))).toBeUndefined();
    expect(held.get(boardQuarantineKey('broken'))).toBe('this is not a board');
    expect(held.has(boardKey('good'))).toBe(true);
  });

  it('says whether it holds a board the record names, or a payload it finds', async () => {
    const { held, store } = memoryStore();
    const library = createLibrary(store);
    await library.create(board('held', 'Held'));

    expect(await library.holds('held')).toBe(true);
    expect(await library.holds('never-created')).toBe(false);

    held.delete(LIBRARY_KEY);

    expect(await library.holds('held')).toBe(true);
  });

  it('writes only the open board, so another board is byte-for-byte unchanged', async () => {
    const open = board('open', 'Open');
    const other = board('other', 'Other', 30, [rectangle]);
    const { held, store } = memoryStore();
    const library = createLibrary(store);
    await library.create(open);
    await library.create(other);
    const untouched = held.get(boardKey('other'));

    const editor = createEditor(open);
    const autosave = createAutosave({
      editor,
      now: () => 4000,
      storage: library.storage('open'),
    });
    editor.setTheme('dark');
    await autosave.flush();

    expect(held.get(boardKey('other'))).toBe(untouched);
    expect(held.get(boardKey('open'))).not.toBe(JSON.stringify(open));
  });

  it('updates the record with the same save time the payload carries', async () => {
    const { held, store } = memoryStore();
    const library = createLibrary(store);
    const open = board('open', 'Open', 10);
    await library.create(open);
    held.delete(LIBRARY_KEY);

    const editor = createEditor(open);
    const autosave = createAutosave({
      editor,
      now: () => 5000,
      storage: library.storage('open'),
    });
    editor.setTheme('dark');
    await autosave.flush();

    const payload = JSON.parse(held.get(boardKey('open')) ?? 'null') as Board;
    expect(payload.updatedAt).toBe(5000);
    expect(recordOf(held).boards).toEqual([
      { id: 'open', title: 'Open', updatedAt: 5000 },
    ]);
  });
});
