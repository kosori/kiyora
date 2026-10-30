/**
 * Where a board's bytes live. The browser owns the actual storage, so the engine
 * takes this port rather than reaching for `indexedDB` or `localStorage` itself:
 * that is what keeps `editor` DOM-free, and it is what lets a test hand in a
 * memory store.
 *
 * `snapshot` and `quarantine` write to keys of their own. They exist so that a
 * rewrite never destroys what came before: the snapshot keeps the bytes a
 * migration is about to replace, and the quarantine parks bytes that will not
 * read, so a fresh board never lands on top of a good one.
 */
export type BoardStorage = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  /** Keeps the pre-migration bytes as a recovery snapshot. */
  snapshot: (value: string) => Promise<void>;
  /** Moves unreadable bytes to a key of their own, freeing the board key. */
  quarantine: (value: string) => Promise<void>;
  /**
   * Whether this store can hold a board's image payloads. IndexedDB can; the
   * localStorage fallback cannot, because its quota is far below one board's
   * pictures. Absent means it can, so only a store that knows its own limit
   * has to say so.
   */
  supportsFiles?: boolean;
};

/**
 * The string-keyed store the browser backs a library with. IndexedDB,
 * localStorage and memory each implement it, and nothing above this line needs
 * to know which one is underneath. `keys` exists so a lost library record can be
 * rebuilt from the board keys alone.
 */
export type KeyValueStore = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  keys: () => Promise<string[]>;
  supportsFiles?: boolean;
};

/** The prefix every board payload, snapshot and quarantine shares. */
export const BOARD_PREFIX = 'kiyora:boards:';

/** Where the library record lists every board this browser holds. */
export const LIBRARY_KEY = 'kiyora:library';

/** The board's storage key. Its id is the only part that varies. */
export const boardKey = (id: string): string => `${BOARD_PREFIX}${id}`;

/** Where the bytes replaced by a migration for `id` are kept. */
export const boardSnapshotKey = (id: string): string =>
  `${boardKey(id)}:snapshot`;

/** Where bytes for `id` that will not read are parked. */
export const boardQuarantineKey = (id: string): string =>
  `${boardKey(id)}:quarantine`;

/** The board key as it was before the library, adopted once by the upgrade. */
export const LEGACY_BOARD_KEY = 'kiyora:board';

/** The legacy snapshot key, moved beside the adopted board. */
export const LEGACY_SNAPSHOT_KEY = 'kiyora:board:snapshot';

/** The legacy quarantine key, moved beside the adopted board. */
export const LEGACY_QUARANTINE_KEY = 'kiyora:board:quarantine';

/**
 * One board's storage over a library-wide store. The keys are namespaced by the
 * board's id, so two boards never share a payload, a snapshot or a quarantine.
 */
export const boardStorage = (
  store: KeyValueStore,
  id: string
): BoardStorage => ({
  quarantine: async (value) => {
    await store.put(boardQuarantineKey(id), value);
    await store.delete(boardKey(id));
  },
  read: () => store.get(boardKey(id)),
  snapshot: (value) => store.put(boardSnapshotKey(id), value),
  supportsFiles: store.supportsFiles,
  write: (value) => store.put(boardKey(id), value),
});

/**
 * Whether the board is on disk. `unsaved` covers both a change still inside the
 * debounce and a write that failed; the two are told apart by the fault beside
 * the status.
 */
export type SaveStatus = 'saved' | 'saving' | 'unsaved';
