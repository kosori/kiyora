/**
 * Where a board's bytes live. The browser owns the actual storage, so the engine
 * takes this port rather than reaching for `indexedDB` or `localStorage` itself:
 * that is what keeps `editor` DOM-free, and it is what lets a test hand in a
 * memory store.
 */
export type BoardStorage = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
};

/** The board's storage key. Every Kiyora key is namespaced, so nothing collides. */
export const BOARD_KEY = 'kiyora:board';

/**
 * Whether the board is on disk. `unsaved` covers both a change still inside the
 * debounce and a write that failed; the two are told apart only once storage
 * carries typed faults.
 */
export type SaveStatus = 'saved' | 'saving' | 'unsaved';
