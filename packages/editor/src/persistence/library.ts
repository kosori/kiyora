import { type Board, serializeBoard } from '@kiyora/model';
import { type BoardLoad, loadBoard } from './board';
import {
  entryOf,
  type LibraryEntry,
  type LibrarySyncRecord,
  newestFirst,
  readRecord,
  rebuild,
  upsert,
  writeRecord,
} from './library-record';
import {
  type BoardStorage,
  boardConflictKey,
  boardKey,
  boardQuarantineKey,
  boardSnapshotKey,
  boardStorage,
  type KeyValueStore,
  LEGACY_BOARD_KEY,
  LEGACY_QUARANTINE_KEY,
  LEGACY_SNAPSHOT_KEY,
} from './storage';

export type {
  LibraryEntry,
  LibraryRecord,
  LibrarySyncRecord,
} from './library-record';

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
  /**
   * Adds a board from a file. Its id is kept when the library does not hold it;
   * when it does, a new client id is minted, so two boards never share one.
   * Returns the entry as stored.
   */
  importBoard: (board: Board) => Promise<LibraryEntry>;
  /**
   * Renames a held board: the payload carries the new title and time before the
   * record names it, so the two cannot disagree after a reload. Returns the
   * updated entry, or `null` when the library does not hold the board.
   */
  rename: (id: string, title: string) => Promise<LibraryEntry | null>;
  /**
   * Copies a held board under a new id, keeping its shapes, files, deck and
   * camera. The copy's own times start now and its title says it is a copy.
   * Returns the new id, or `null` when the library does not hold the board.
   */
  duplicate: (id: string) => Promise<string | null>;
  /**
   * Deletes a board's payload, snapshot and quarantine, then its record entry.
   * Returns whether anything was removed.
   */
  remove: (id: string) => Promise<boolean>;
};

/** The clock and id mint a rename or a duplicate needs, injected for tests. */
export type LibraryOptions = {
  /** Stamps a rename or a duplicate's times. Defaults to `Date.now`. */
  now?: () => number;
  /** Names a duplicate. Defaults to `crypto.randomUUID`. */
  mintId?: () => string;
};

/** The title a duplicate wears, the way a file manager names a second copy. */
const copyTitle = (title: string): string =>
  title.trim() === '' ? 'Untitled copy' : `${title} copy`;

/** The stored payload as a JSON object, or `null` when the bytes will not read. */
const readPayload = (bytes: string | null): Record<string, unknown> | null => {
  if (bytes === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(bytes) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * The library over `store`. Every board's payload, snapshot and quarantine sit
 * under its own id, so a write for one board can never touch another's bytes.
 * `storage` is the per-board port autosave takes; its write refreshes the
 * record afterwards, so the list follows a save.
 */
export const createLibrary = (
  store: KeyValueStore,
  { now = Date.now, mintId = () => crypto.randomUUID() }: LibraryOptions = {}
): Library => {
  const storage = (id: string): BoardStorage => {
    const board = boardStorage(store, id);

    return {
      ...board,
      write: async (value, preview) => {
        await board.write(value);
        const entry = entryOf(id, value);
        if (entry !== null) {
          await upsert(store, entry, preview);
        }
      },
    };
  };

  /** Writes one board's bytes, then the record entry they name. */
  const writePayload = async (
    id: string,
    payload: Record<string, unknown>,
    preview?: string
  ): Promise<LibraryEntry> => {
    const bytes = JSON.stringify(payload);
    await store.put(boardKey(id), bytes);
    const entry = entryOf(id, bytes) ?? { id, title: '', updatedAt: 0 };
    return upsert(store, entry, preview);
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

  const freeId = async (preferred: string): Promise<string> => {
    if (!(await holds(preferred))) {
      return preferred;
    }
    const mintFree = async (): Promise<string> => {
      const candidate = mintId();
      return (await holds(candidate)) ? mintFree() : candidate;
    };
    return mintFree();
  };

  return {
    create: async (board) => {
      await storage(board.id).write(serializeBoard(board));
    },
    duplicate: async (id) => {
      const [bytes, record] = await Promise.all([
        store.get(boardKey(id)),
        readRecord(store),
      ]);
      const payload = readPayload(bytes);
      if (payload === null) {
        return null;
      }
      const copyId = mintId();
      const stamp = now();
      const preview = record?.boards.find((board) => board.id === id)?.preview;
      await writePayload(
        copyId,
        {
          ...payload,
          createdAt: stamp,
          id: copyId,
          title: copyTitle(
            typeof payload.title === 'string' ? payload.title : ''
          ),
          updatedAt: stamp,
        },
        preview
      );
      return copyId;
    },
    entries,
    holds,
    importBoard: async (board) => {
      const id = await freeId(board.id);
      return writePayload(id, { ...board, id });
    },
    load: (id) => loadBoard(boardStorage(store, id)),
    remove: async (id) => {
      const [payload, record] = await Promise.all([
        store.get(boardKey(id)),
        readRecord(store),
      ]);
      const listed = record?.boards.some((board) => board.id === id) ?? false;
      await Promise.all([
        store.delete(boardKey(id)),
        store.delete(boardSnapshotKey(id)),
        store.delete(boardConflictKey(id)),
        store.delete(boardQuarantineKey(id)),
      ]);
      if (record !== null) {
        const boards = record.boards.filter((board) => board.id !== id);
        if (boards.length !== record.boards.length) {
          await writeRecord(store, boards);
        }
      }
      return payload !== null || listed;
    },
    rename: async (id, title) => {
      const payload = readPayload(await store.get(boardKey(id)));
      if (payload === null) {
        return null;
      }
      return writePayload(id, { ...payload, title, updatedAt: now() });
    },
    setSync: async (id, sync) => {
      const record = await readRecord(store);
      const boards = record?.boards ?? (await rebuild(store));
      const previous = boards.find((board) => board.id === id);
      if (previous === undefined) {
        return;
      }
      await upsert(store, {
        ...previous,
        conflict: sync.conflict ?? undefined,
        linked: sync.linked ? true : undefined,
        pending: sync.pending ? true : undefined,
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
