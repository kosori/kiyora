import type { Board } from '@kiyora/model';
import { createHistory, type HistoryState } from './stack';

/**
 * The gesture bookkeeping behind the store: what commits, when a run of nudges
 * collapses, and undo and redo. Every commit notifies its subscribers, so a
 * control reads availability from the notification rather than by polling.
 */
export type Transactions = {
  /** Opens the label edit's transaction from `before`, or joins the one already open. */
  beginEdit: (before: Board) => void;
  /** The board the open label edit began on, closed without committing; `null` when none. */
  cancelEdit: () => Board | null;
  /** Forgets every entry, so a newly opened board starts with a clean slate. */
  clear: () => void;
  /** Records `before` as one entry when the gesture changed the board. */
  commit: (before: Board, current: Board) => void;
  /** Commits the open label edit, closing it, when it changed the board. */
  endEdit: (current: Board) => void;
  /** Closes the open run of nudges, committing it as one entry. */
  endNudgeRun: () => void;
  /** Whether undo and redo are possible, as a stable value between changes. */
  getState: () => HistoryState;
  /** Whether a label edit is open, so a write outside one is its own gesture. */
  isEditing: () => boolean;
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
  let edit: Board | null = null;

  const flush = (): void => {
    if (run === null) {
      return;
    }
    const before = run;
    run = null;
    history.commit(before);
  };

  /**
   * Commits the open edit. The move and the words it carried are one board, so
   * one entry puts both back; an edit that changed nothing — a label left as it
   * was — commits nothing and just closes.
   */
  const endEdit = (current: Board): void => {
    const before = edit;
    edit = null;
    if (before !== null && before !== current) {
      history.commit(before);
    }
  };

  return {
    beginEdit: (before) => {
      edit ??= before;
    },
    cancelEdit: () => {
      const before = edit;
      edit = null;
      return before;
    },
    clear: () => {
      edit = null;
      history.clear();
    },
    commit: (before, current) => {
      if (before !== current) {
        history.commit(before);
      }
    },
    endEdit,
    endNudgeRun: flush,
    getState: () => history.getState(),
    isEditing: () => edit !== null,
    noteNudge: (before) => {
      run ??= before;
    },
    redo: (current) => {
      flush();
      endEdit(current);
      return history.redo(current);
    },
    subscribe: (listener) => history.subscribe(listener),
    undo: (current) => {
      flush();
      endEdit(current);
      return history.undo(current);
    },
  };
};
