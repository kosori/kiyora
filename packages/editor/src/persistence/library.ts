import { type Board, serializeBoard } from '@kiyora/model';
import { type BoardLoad, loadBoard } from './board';
import {
  BOARD_PREFIX,
  type BoardStorage,
  boardKey,
  boardQuarantineKey,
  boardSnapshotKey,
  boardStorage,
  type KeyValueStore,
  LEGACY_BOARD_KEY,
  LEGACY_QUARANTINE_KEY,
  LEGACY_SNAPSHOT_KEY,
  LIBRARY_KEY,
} from './storage';

/**
 * One row of the library. The record never carries the board itself, only what
 * the list shows, so listing a hundred boards opens no payload.
 */
export type LibraryEntry = {
  id: string;
  title: string;
  updatedAt: number;
  /** Whether this board has a remote copy the local one is kept in step with. */
  linked?: boolean;
  /** The revision the local copy was built on, when it is linked. */
  revision?: number;
  /** The remote revision that refused a write, until a person resolves it. */
  conflict?: number;
  /** Whether the board is too large for the sync limit. */
  tooLarge?: boolean;
  preview?: string;
};

/** What sync learned about one board, as the record keeps it. */
export type LibrarySyncRecord = {
  linked: boolean;
  revision: number | null;
  conflict: number | null;
  tooLarge: boolean;
};

/** The library record: a cache of the entries, ordered by last change when read. */
export type LibraryRecord = {
  version: 1;
  boards: LibraryEntry[];
};

/** The library over one store: the list, each board's storage, and its load. */
export type Library = {
  /** Every board this browser holds, newest change first. Rebuilds a lost record. */
  entries: () => Promise<LibraryEntry[]>;
  /** Whether this library holds `id`, by record or by payload. */
  holds: (id: string) => Promise<boolean>;
  /** Reads one board through its own storage, migrating it if it is older. */
  load: (id: string) => Promise<BoardLoad>;
  /** One board's storage, whose write also refreshes the record entry. */
  storage: (id: string) => BoardStorage;
  /** Adds a board: its payload first, then its record entry. */
  create: (board: Board) => Promise<void>;
  /** Records what sync learned about one board, keeping its other fields. */
  setSync: (id: string, sync: LibrarySyncRecord) => Promise<void>;
};

const RECORD_VERSION = 1;

const isEntry = (value: unknown): value is LibraryEntry => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.updatedAt === 'number'
  );
};

const readRecord = async (
  store: KeyValueStore
): Promise<LibraryRecord | null> => {
  const bytes = await store.get(LIBRARY_KEY);
  if (bytes === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(bytes) as {
      version?: unknown;
      boards?: unknown;
    };
    if (parsed.version !== RECORD_VERSION || !Array.isArray(parsed.boards)) {
      return null;
    }
    if (!parsed.boards.every(isEntry)) {
      return null;
    }
    return { boards: parsed.boards, version: RECORD_VERSION };
  } catch {
    return null;
  }
};

const writeRecord = (
  store: KeyValueStore,
  boards: LibraryEntry[]
): Promise<void> =>
  store.put(LIBRARY_KEY, JSON.stringify({ boards, version: RECORD_VERSION }));

const newestFirst = (boards: LibraryEntry[]): LibraryEntry[] =>
  [...boards].sort((left, right) => right.updatedAt - left.updatedAt);

/** Whether a store key holds a board payload, rather than its snapshot or quarantine. */
const isPayloadKey = (key: string): boolean =>
  key.startsWith(BOARD_PREFIX) &&
  !key.endsWith(':snapshot') &&
  !key.endsWith(':quarantine');

/**
 * The record entry a payload names, read without validating the whole board:
 * the list only needs a title and a time, and an older schema is still listed
 * until it is opened and lifted. Bytes that are not JSON have no entry.
 */
const entryOf = (id: string, bytes: string): LibraryEntry | null => {
  try {
    const parsed = JSON.parse(bytes) as {
      title?: unknown;
      updatedAt?: unknown;
    } | null;
    if (parsed === null) {
      return null;
    }
    return {
      id,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
};

/**
 * Every board the store holds, found by scanning the board prefix. A payload
 * that will not parse is parked under that board's quarantine key and skipped,
 * so one damaged board cannot hide the rest. Nothing is written here except
 * those quarantines.
 */
const scanEntries = async (store: KeyValueStore): Promise<LibraryEntry[]> => {
  const keys = await store.keys();
  const found = await Promise.all(
    keys.filter(isPayloadKey).map(async (key): Promise<LibraryEntry | null> => {
      const id = key.slice(BOARD_PREFIX.length);
      const bytes = await store.get(key);
      if (bytes === null) {
        return null;
      }
      const entry = entryOf(id, bytes);
      if (entry !== null) {
        return entry;
      }
      try {
        await store.put(boardQuarantineKey(id), bytes);
        await store.delete(key);
      } catch {
        // The bytes stay where they are; the next rebuild tries again.
      }
      return null;
    })
  );

  return found.filter((entry): entry is LibraryEntry => entry !== null);
};

/** Rebuilds the record from the board keys, and returns what it found. */
const rebuild = async (store: KeyValueStore): Promise<LibraryEntry[]> => {
  const boards = newestFirst(await scanEntries(store));
  try {
    await writeRecord(store, boards);
  } catch {
    // The record is a cache: the list is still good without it.
  }
  return boards;
};

/** Writes one entry over the record, rebuilding a lost record first. */
const upsert = async (
  store: KeyValueStore,
  entry: LibraryEntry
): Promise<void> => {
  const record = await readRecord(store);
  const boards = record?.boards ?? (await scanEntries(store));
  const previous = boards.find((board) => board.id === entry.id);
  const next = newestFirst([
    ...boards.filter((board) => board.id !== entry.id),
    previous === undefined ? entry : { ...previous, ...entry },
  ]);
  await writeRecord(store, next);
};

/**
 * The library over `store`. Every board's payload, snapshot and quarantine sit
 * under its own id, so a write for one board can never touch another's bytes.
 * `storage` is the per-board port autosave takes; its write refreshes the
 * record afterwards, so the list follows a save.
 */
export const createLibrary = (store: KeyValueStore): Library => {
  const storage = (id: string): BoardStorage => {
    const board = boardStorage(store, id);

    return {
      ...board,
      write: async (value) => {
        await board.write(value);
        const entry = entryOf(id, value);
        if (entry !== null) {
          await upsert(store, entry);
        }
      },
    };
  };

  const entries = async (): Promise<LibraryEntry[]> => {
    const record = await readRecord(store);
    return record === null ? rebuild(store) : newestFirst(record.boards);
  };

  const holds = async (id: string): Promise<boolean> => {
    const record = await readRecord(store);
    if (record !== null) {
      if (record.boards.some((board) => board.id === id)) {
        return true;
      }
      return (await store.get(boardKey(id))) !== null;
    }
    const rebuilt = await rebuild(store);
    return rebuilt.some((board) => board.id === id);
  };

  return {
    create: async (board) => {
      await storage(board.id).write(serializeBoard(board));
    },
    entries,
    holds,
    load: (id) => loadBoard(boardStorage(store, id)),
    setSync: async (id, sync) => {
      const record = await readRecord(store);
      const boards = record?.boards ?? (await scanEntries(store));
      const previous = boards.find((board) => board.id === id);
      if (previous === undefined) {
        return;
      }
      await upsert(store, {
        ...previous,
        conflict: sync.conflict ?? undefined,
        linked: sync.linked ? true : undefined,
        revision: sync.linked ? (sync.revision ?? undefined) : undefined,
        tooLarge: sync.tooLarge ? true : undefined,
      });
    },
    storage,
  };
};

/**
 * Adopts the single board the browser held before the library. Its payload moves
 * under its stored id, its snapshot and quarantine move beside it, and only once
 * the record names it are the legacy keys deleted — a record that cannot be
 * written leaves the old board where it was. A second run finds no legacy board
 * and changes nothing.
 */
export const adoptLegacyBoard = async (
  store: KeyValueStore
): Promise<LibraryEntry | null> => {
  const bytes = await store.get(LEGACY_BOARD_KEY);
  if (bytes === null) {
    return null;
  }

  let payload: { id?: unknown; title?: unknown; updatedAt?: unknown };
  try {
    payload = JSON.parse(bytes) as typeof payload;
  } catch {
    return null;
  }
  if (payload === null) {
    return null;
  }
  const { id } = payload;
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }

  await store.put(boardKey(id), bytes);

  const [snapshot, quarantine] = await Promise.all([
    store.get(LEGACY_SNAPSHOT_KEY),
    store.get(LEGACY_QUARANTINE_KEY),
  ]);
  await Promise.all([
    snapshot === null
      ? Promise.resolve()
      : store.put(boardSnapshotKey(id), snapshot),
    quarantine === null
      ? Promise.resolve()
      : store.put(boardQuarantineKey(id), quarantine),
  ]);

  const entry: LibraryEntry = {
    id,
    title: typeof payload.title === 'string' ? payload.title : '',
    updatedAt: typeof payload.updatedAt === 'number' ? payload.updatedAt : 0,
  };
  await upsert(store, entry);

  await store.delete(LEGACY_BOARD_KEY);
  await store.delete(LEGACY_SNAPSHOT_KEY);
  await store.delete(LEGACY_QUARANTINE_KEY);

  return entry;
};
