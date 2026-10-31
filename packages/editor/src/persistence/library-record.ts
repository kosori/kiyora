import {
  BOARD_PREFIX,
  boardQuarantineKey,
  type KeyValueStore,
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
  linked?: boolean;
  tooLarge?: boolean;
  preview?: string;
};

/** The library record: a cache of the entries, ordered by last change when read. */
export type LibraryRecord = {
  version: 1;
  boards: LibraryEntry[];
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

/** Reads the record, or `null` when it is absent, unreadable or from another version. */
export const readRecord = async (
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

/** Writes the record over every entry it names. */
export const writeRecord = (
  store: KeyValueStore,
  boards: LibraryEntry[]
): Promise<void> =>
  store.put(LIBRARY_KEY, JSON.stringify({ boards, version: RECORD_VERSION }));

/** The entries ordered by last change, newest first. */
export const newestFirst = (boards: LibraryEntry[]): LibraryEntry[] =>
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
export const entryOf = (id: string, bytes: string): LibraryEntry | null => {
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
export const scanEntries = async (
  store: KeyValueStore
): Promise<LibraryEntry[]> => {
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
export const rebuild = async (
  store: KeyValueStore
): Promise<LibraryEntry[]> => {
  const boards = newestFirst(await scanEntries(store));
  try {
    await writeRecord(store, boards);
  } catch {
    // The record is a cache: the list is still good without it.
  }
  return boards;
};

/** Writes one entry over the record, rebuilding a lost record first. */
export const upsert = async (
  store: KeyValueStore,
  entry: LibraryEntry
): Promise<void> => {
  const record = await readRecord(store);
  const boards = record?.boards ?? (await scanEntries(store));
  const next = newestFirst([
    ...boards.filter((board) => board.id !== entry.id),
    entry,
  ]);
  await writeRecord(store, next);
};
