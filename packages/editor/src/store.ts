import type { Board } from '@kiyora/model';

/**
 * The engine: it holds one board and publishes every change to its
 * subscribers. Nothing here touches the DOM, so a gesture, a command or a
 * migration is proven without a browser.
 */
export type Editor = {
  /** The board as it stands. The same reference until something changes it. */
  getBoard: () => Board;
  /** Replaces the board and notifies every subscriber. */
  setBoard: (board: Board) => void;
  /** Subscribes to board changes. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
};

/** An engine over `board`, holding it and publishing each replacement. */
export const createEditor = (board: Board): Editor => {
  let current = board;
  const listeners = new Set<() => void>();

  return {
    getBoard: () => current,
    setBoard: (next) => {
      current = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
