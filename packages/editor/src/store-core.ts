import type { Board, Style } from '@kiyora/model';
import type { HistoryState } from './history/stack';
import { createTransactions, type Transactions } from './history/transaction';
import { normaliseSelection, type Selection, sameIds } from './selection';
import type { View } from './state';
import { subscriptionOf } from './subscription';
import { DEFAULT_STYLE } from './tools';

/**
 * The engine's mutable core: the board, the view, the style, the selection and
 * the history, plus the three ways a board write lands. The gestures and the
 * command factories own one concern each and share this one write funnel, so
 * there is still one place that decides what a change publishes and whether it
 * costs a history entry.
 */
export type StoreCore = {
  /** The board as it stands. The same reference until something changes it. */
  board: () => Board;
  /** Adopts `next` and publishes it, unless it is the same board. */
  publish: (next: Board) => void;
  /** Adopts `next` as one gesture: one history entry and one save. */
  change: (next: Board) => void;
  /**
   * Adopts `next` and publishes it, recording no entry: the seam for a write
   * whose history is somebody else's. Undo and redo rewind it, a board load
   * clears it, and a placement hands its first entry to the label overlay. Every
   * other write is a `change`.
   */
  adopt: (next: Board) => void;
  view: () => View;
  setView: (next: View) => void;
  style: () => Style;
  setStyle: (next: Style) => void;
  selection: () => Selection;
  /** Keeps only ids the board holds, in paint order, and publishes a real change. */
  select: (next: Selection) => void;
  transactions: Transactions;
  getHistory: () => HistoryState;
  subscribe: (listener: () => void) => () => void;
  subscribeView: (listener: () => void) => () => void;
  subscribeSelection: (listener: () => void) => () => void;
  subscribeHistory: (listener: () => void) => () => void;
};

/** The core over `board`, with the selection, the view and the history it starts empty. */
export const createStoreCore = (board: Board): StoreCore => {
  let current = board;
  let view: View = {
    camera: board.camera,
    tool: 'select',
    zen: false,
  };
  let style: Style = DEFAULT_STYLE;
  let selection: Selection = [];
  const transactions = createTransactions();
  const listeners = new Set<() => void>();
  const viewListeners = new Set<() => void>();
  const selectionListeners = new Set<() => void>();

  const publish = (set: Set<() => void>): void => {
    for (const listener of set) {
      listener();
    }
  };

  const replace = (next: Board): void => {
    current = next;
  };

  /** Adopts `next` unconditionally and publishes it, for a write with no entry of its own. */
  const adopt = (next: Board): void => {
    replace(next);
    publish(listeners);
  };

  /** Adopts `next` as the board and publishes it, unless it is the same board. */
  const publishBoard = (next: Board): void => {
    if (next === current) {
      return;
    }
    adopt(next);
  };

  const setView = (next: View): void => {
    view = next;
    publish(viewListeners);
  };

  /** Keeps only ids the board holds, in paint order, and publishes a real change. */
  const commitSelection = (next: Selection): void => {
    const ids = normaliseSelection(current, next);
    if (sameIds(ids, selection)) {
      return;
    }
    transactions.endNudgeRun();
    selection = ids;
    publish(selectionListeners);
  };

  /**
   * Applies one board edit as one gesture: the board moves, the history records
   * it once, and the subscribers are woken so autosave saves it.
   */
  const change = (next: Board): void => {
    if (next === current) {
      return;
    }
    transactions.endNudgeRun();
    const before = current;
    replace(next);
    transactions.commit(before, current);
    publish(listeners);
  };

  return {
    adopt,
    board: () => current,
    change,
    getHistory: transactions.getState,
    publish: publishBoard,
    select: commitSelection,
    selection: () => selection,
    setStyle: (next) => {
      style = next;
    },
    setView,
    style: () => style,
    subscribe: subscriptionOf(listeners),
    subscribeHistory: transactions.subscribe,
    subscribeSelection: subscriptionOf(selectionListeners),
    subscribeView: subscriptionOf(viewListeners),
    transactions,
    view: () => view,
  };
};
