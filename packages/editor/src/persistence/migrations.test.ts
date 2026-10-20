import { type BoardStorage, loadBoard, StorageError } from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (): Board =>
  parseBoard({
    camera: { x: 3, y: 4, zoom: 2 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [],
    title: 'Legacy',
    updatedAt: 1_700_000_000_000,
  });

/** The same board as a save from before the record carried a version marker. */
const unversioned = (): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(board()).filter(([key]) => key !== 'schemaVersion')
    )
  );

type Recorder = {
  storage: BoardStorage;
  snapshot: string[];
  quarantine: string[];
};

const recorder = (
  seed: string | null,
  overrides: Partial<BoardStorage> = {}
): Recorder => {
  const snapshot: string[] = [];
  const quarantine: string[] = [];

  const storage: BoardStorage = {
    quarantine: (value) => {
      quarantine.push(value);
      return Promise.resolve();
    },
    read: () => Promise.resolve(seed),
    snapshot: (value) => {
      snapshot.push(value);
      return Promise.resolve();
    },
    write: () => Promise.resolve(),
    ...overrides,
  };

  return { quarantine, snapshot, storage };
};

describe('lifting an older board', () => {
  it('keeps the previous bytes as a recovery snapshot and opens the lifted board', async () => {
    const bytes = unversioned();
    const { snapshot, storage } = recorder(bytes);

    const result = await loadBoard(storage);

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') {
      throw new Error('expected a loaded board');
    }
    expect(result.migratedFrom).toBe(0);
    expect(result.board.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.board.title).toBe('Legacy');
    expect(result.board.camera).toEqual({ x: 3, y: 4, zoom: 2 });
    expect(snapshot).toEqual([bytes]);
  });

  it('refuses to migrate when the snapshot cannot be kept', async () => {
    const { storage } = recorder(unversioned(), {
      snapshot: () => Promise.reject(new StorageError({ kind: 'quota' })),
    });

    const result = await loadBoard(storage);

    expect(result).toEqual({
      fault: { kind: 'quota' },
      quarantined: false,
      status: 'fault',
    });
  });
});

describe('quarantining unreadable data', () => {
  it('parks bytes that will not parse, and says they are parked', async () => {
    const { quarantine, storage } = recorder('not json at all');

    const result = await loadBoard(storage);

    expect(result).toEqual({
      fault: { kind: 'corrupt', reason: 'damaged' },
      quarantined: true,
      status: 'fault',
    });
    expect(quarantine).toEqual(['not json at all']);
  });

  it('parks a board from a newer release instead of guessing at it', async () => {
    const future = JSON.stringify({ ...board(), schemaVersion: 99 });
    const { quarantine, storage } = recorder(future);

    const result = await loadBoard(storage);

    expect(result).toEqual({
      fault: { kind: 'corrupt', reason: 'newer' },
      quarantined: true,
      status: 'fault',
    });
    expect(quarantine).toEqual([future]);
  });

  it('reports bytes it could not park, so the caller knows not to overwrite', async () => {
    const { storage } = recorder('garbage', {
      quarantine: () => Promise.reject(new StorageError({ kind: 'blocked' })),
    });

    const result = await loadBoard(storage);

    expect(result).toMatchObject({ quarantined: false, status: 'fault' });
  });
});

describe('a read that fails outright', () => {
  it('reports the fault rather than pretending the board is absent', async () => {
    const { storage } = recorder(null, {
      read: () => Promise.reject(new StorageError({ kind: 'blocked' })),
    });

    expect(await loadBoard(storage)).toEqual({
      fault: { kind: 'blocked' },
      quarantined: false,
      status: 'fault',
    });
  });
});
