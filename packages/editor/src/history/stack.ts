import type { Board } from '@kiyora/model';

/** The most entries the in-memory history holds. Older entries fall off the end. */
export const HISTORY_LIMIT = 200;

/** Whether undo and redo are possible, as one value a control can read. */
export type HistoryState = {
  canRedo: boolean;
  canUndo: boolean;
};

/**
 * The undo and redo stack of committed gestures. It holds the board as it was
 * before each gesture, bounded and in memory only: autosave owns the document,
 * so a persisted history would only add a second format to migrate.
 */
export type History = {
  /** Whether there is a gesture to undo. */
  canUndo: () => boolean;
  /** Whether there is a gesture to redo. */
  canRedo: () => boolean;
  /** Forgets every entry, so a newly opened board starts with a clean slate. */
  clear: () => void;
  /** Records the board a gesture started from, and clears the redo stack. */
  commit: (before: Board) => void;
  /** How many entries the undo stack holds, for the bound's own test. */
  depth: () => number;
  /** Whether undo and redo are possible, as a stable value between changes. */
  getState: () => HistoryState;
  /** The board before the last un-undone gesture, or `null` when there is none. */
  redo: (current: Board) => Board | null;
  /** Subscribes to availability changes, so a control re-reads it. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** The board before the last gesture, or `null` when there is none. */
  undo: (current: Board) => Board | null;
};

/**
 * A history over `limit` gestures. Every commit notifies its subscribers, so a
 * control reads whether undo is possible from the notification rather than by
 * polling; that notification is what keeps a stale undo button from shipping.
 */
export const createHistory = (limit = HISTORY_LIMIT): History => {
  let past: Board[] = [];
  let future: Board[] = [];
  let state: HistoryState = { canRedo: false, canUndo: false };
  const listeners = new Set<() => void>();

  const publish = (): void => {
    state = { canRedo: future.length > 0, canUndo: past.length > 0 };
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    canRedo: () => future.length > 0,
    canUndo: () => past.length > 0,
    clear: () => {
      past = [];
      future = [];
      publish();
    },
    commit: (before) => {
      past = [...past, before];
      if (past.length > limit) {
        past = past.slice(past.length - limit);
      }
      future = [];
      publish();
    },
    depth: () => past.length,
    getState: () => state,
    redo: (current) => {
      const next = future.at(-1);
      if (next === undefined) {
        return null;
      }
      future = future.slice(0, -1);
      past = [...past, current];
      publish();
      return next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    undo: (current) => {
      const previous = past.at(-1);
      if (previous === undefined) {
        return null;
      }
      past = past.slice(0, -1);
      future = [...future, current];
      publish();
      return previous;
    },
  };
};
