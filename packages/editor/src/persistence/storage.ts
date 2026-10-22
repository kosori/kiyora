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

/** The board's storage key. Every Kiyora key is namespaced, so nothing collides. */
export const BOARD_KEY = 'kiyora:board';

/** Where the bytes replaced by a migration are kept. */
export const SNAPSHOT_KEY = 'kiyora:board:snapshot';

/** Where bytes that will not read are parked, never overwritten by a fresh board. */
export const QUARANTINE_KEY = 'kiyora:board:quarantine';

/**
 * Whether the board is on disk. `unsaved` covers both a change still inside the
 * debounce and a write that failed; the two are told apart by the fault beside
 * the status.
 */
export type SaveStatus = 'saved' | 'saving' | 'unsaved';
