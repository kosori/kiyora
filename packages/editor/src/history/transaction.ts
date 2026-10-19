import type { Board } from '@kiyora/model';
import { createHistory, type HistoryState } from './stack';

/**
 * The gesture bookkeeping behind the store: what commits, when a run of nudges
 * collapses, and undo and redo. Every commit notifies its subscribers, so a
 * control reads availability from the notification rather than by polling.
 */
export type Transactions = {
  /** Forgets every entry, so a newly opened board starts with a clean slate. */
  clear: () => void;
  /** Records `before` as one entry when the gesture changed the board. */
  commit: (before: Board, current: Board) => void;
  /** Closes the open run of nudges, committing it as one entry. */
  endNudgeRun: () => void;
  /** Whether undo and redo are possible, as a stable value between changes. */
  getState: () => HistoryState;
  /** Opens a run of nudges from `before`, or extends the one already open. */
  noteNudge: (before: Board) => void;
  /** The board before the last un-undone gesture, or `null` when there is none. */
  redo: (current: Board) => Board | null;
  /** Subscribes to availability changes. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** The board before the last gesture, or `null` when there is none. */
  undo: (current: Board) => Board | null;
};

/** The transactions over one board, with a bounded in-memory history behind them. */
export const createTransactions = (): Transactions => {
  const history = createHistory();
  let run: Board | null = null;

  const flush = (): void => {
    if (run === null) {
      return;
    }
    const before = run;
    run = null;
    history.commit(before);
  };

  return {
    clear: () => history.clear(),
    commit: (before, current) => {
      if (before !== current) {
        history.commit(before);
      }
    },
    endNudgeRun: flush,
    getState: () => history.getState(),
    noteNudge: (before) => {
      run ??= before;
    },
    redo: (current) => {
      flush();
      return history.redo(current);
    },
    subscribe: (listener) => history.subscribe(listener),
    undo: (current) => {
      flush();
      return history.undo(current);
    },
  };
};
