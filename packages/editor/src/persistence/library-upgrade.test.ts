import {
  adoptLegacyBoard,
  boardKey,
  boardSnapshotKey,
  createLibrary,
  type KeyValueStore,
  LEGACY_BOARD_KEY,
  LEGACY_QUARANTINE_KEY,
  LEGACY_SNAPSHOT_KEY,
  LIBRARY_KEY,
} from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const legacy = (): Board =>
  parseBoard({
    camera: { x: 3, y: 4, zoom: 2 },
    createdAt: 1_600_000_000_000,
    deck: [],
    id: 'legacy-board',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [],
    title: 'Legacy',
    updatedAt: 1_650_000_000_000,
  });

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

describe('adopting the board that existed before the library', () => {
  it('moves it under its stored id, beside its snapshot and quarantine', async () => {
    const payload = JSON.stringify(legacy());
    const { held, store } = memoryStore({
      [LEGACY_BOARD_KEY]: payload,
      [LEGACY_QUARANTINE_KEY]: 'older, damaged bytes',
      [LEGACY_SNAPSHOT_KEY]: 'pre-migration bytes',
    });

    const entry = await adoptLegacyBoard(store);

    expect(entry).toEqual({
      id: 'legacy-board',
      title: 'Legacy',
      updatedAt: 1_650_000_000_000,
    });
    expect(held.get(boardKey('legacy-board'))).toBe(payload);
    expect(held.get(boardSnapshotKey('legacy-board'))).toBe(
      'pre-migration bytes'
    );
    expect(held.get(`${boardKey('legacy-board')}:quarantine`)).toBe(
      'older, damaged bytes'
    );
    expect(held.has(LEGACY_BOARD_KEY)).toBe(false);
    expect(held.has(LEGACY_SNAPSHOT_KEY)).toBe(false);
    expect(held.has(LEGACY_QUARANTINE_KEY)).toBe(false);

    const library = createLibrary(store);
    expect((await library.entries()).map(({ id }) => id)).toEqual([
      'legacy-board',
    ]);
  });

  it('does nothing on a second run, so the upgrade can repeat safely', async () => {
    const { held, store } = memoryStore({
      [LEGACY_BOARD_KEY]: JSON.stringify(legacy()),
    });

    expect(await adoptLegacyBoard(store)).not.toBeNull();
    const after = new Map(held);

    expect(await adoptLegacyBoard(store)).toBeNull();
    expect(held).toEqual(after);
  });

  it('leaves the old board in place when the record cannot be written', async () => {
    const payload = JSON.stringify(legacy());
    const { held, store } = memoryStore({ [LEGACY_BOARD_KEY]: payload });
    const failing: KeyValueStore = {
      ...store,
      put: (key, value) => {
        if (key === LIBRARY_KEY) {
          return Promise.reject(new Error('quota'));
        }
        return store.put(key, value);
      },
    };

    await expect(adoptLegacyBoard(failing)).rejects.toThrow('quota');

    expect(held.get(LEGACY_BOARD_KEY)).toBe(payload);
  });

  it('leaves unreadable legacy bytes where they are', async () => {
    const { held, store } = memoryStore({ [LEGACY_BOARD_KEY]: '{damaged' });

    expect(await adoptLegacyBoard(store)).toBeNull();
    expect(held.get(LEGACY_BOARD_KEY)).toBe('{damaged');
  });
});
