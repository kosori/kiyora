import type { Board } from '@kiyora/model';
import {
  type Clipboard,
  COPY_OFFSET,
  copyFragment,
  duplicateShapes,
  pasteFragment,
} from './clipboard';
import { removeShapes } from './connectors';
import { subtreeIds } from './containment';
import type { Selection } from './selection';

/** The edits the store exposes beside its gestures: the clipboard and the delete. */
export type EditCommands = {
  /** Copies the selection to the app's clipboard. Changes nothing on the board. */
  copy: () => void;
  /** Copies the selection and deletes it as one gesture, so one undo restores both. */
  cut: () => void;
  /** Deletes the selection and everything it holds, as one gesture. */
  deleteSelection: () => void;
  /** Copies the selection clear of itself, as one gesture. */
  duplicate: () => void;
  /** Puts the clipboard on the board clear of what it copies, as one gesture. */
  paste: () => void;
};

type Options = {
  /** The board as it stands. */
  board: () => Board;
  /** Adopts a changed board as one gesture: one history entry, one save. */
  change: (next: Board) => void;
  /** Adopts a changed selection. */
  select: (ids: Selection) => void;
  /** The ids currently selected, in paint order. */
  selection: () => Selection;
};

/**
 * The clipboard and the delete, wired to the store's board and its one-gesture
 * commit. The clipboard lives here rather than on the board: copying changes
 * nothing a user can see, so it is never a history entry and never a save. Each
 * command commits at most once, so a paste of many shapes is one undo, not one
 * entry per shape.
 */
export const createEditCommands = ({
  board,
  change,
  select,
  selection,
}: Options): EditCommands => {
  let clipboard: Clipboard | null = null;
  let pastes = 0;

  /** Records `fragment` as the clipboard and starts its paste cascade over. */
  const keep = (fragment: Clipboard): void => {
    clipboard = fragment;
    pastes = 0;
  };

  const cut: EditCommands['cut'] = () => {
    const before = board();
    const ids = subtreeIds(before, selection());
    if (ids.length === 0) {
      return;
    }
    keep(copyFragment(before, selection()));
    change(removeShapes(before, ids));
    select([]);
  };

  return {
    copy: () => keep(copyFragment(board(), selection())),
    cut,
    deleteSelection: () => {
      const before = board();
      const next = removeShapes(before, subtreeIds(before, selection()));
      if (next === before) {
        return;
      }
      change(next);
      select([]);
    },
    duplicate: () => {
      const before = board();
      if (selection().length === 0) {
        return;
      }
      const copy = duplicateShapes(before, selection());
      change(copy.board);
      select(copy.ids);
    },
    paste: () => {
      if (clipboard === null) {
        return;
      }
      pastes += 1;
      const step = COPY_OFFSET * pastes;
      const copy = pasteFragment(board(), clipboard, step, step);
      change(copy.board);
      select(copy.ids);
    },
  };
};
