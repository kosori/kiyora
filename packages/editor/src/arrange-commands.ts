import type { Board } from '@kiyora/model';
import {
  type Alignment,
  alignBoard,
  type DistributeAxis,
  distributeBoard,
} from './align';
import type { Selection } from './selection';

/** The arrangement commands the store exposes: the six alignments and the two distributions. */
export type ArrangeCommands = {
  /** Lines the selection up to one edge or centre of its own box, as one gesture. */
  align: (alignment: Alignment) => void;
  /** Spaces three or more movable shapes evenly along one axis, as one gesture. */
  distribute: (axis: DistributeAxis) => void;
};

type Options = {
  /** The board as it stands. */
  board: () => Board;
  /** Adopts a changed board as one gesture: one history entry, one save. */
  change: (next: Board) => void;
  /** The ids currently selected, in paint order. */
  selection: () => Selection;
};

/**
 * The arrangement commands, wired to the store's board and its one-gesture
 * commit. Arrangement is geometry, so the work happens in `align.ts`; this
 * module only decides whether the board changed, which is what keeps a no-op
 * from landing in undo.
 */
export const createArrangeCommands = ({
  board,
  change,
  selection,
}: Options): ArrangeCommands => ({
  align: (alignment) => {
    const before = board();
    const next = alignBoard(before, selection(), alignment);
    if (next !== before) {
      change(next);
    }
  },
  distribute: (axis) => {
    const before = board();
    const next = distributeBoard(before, selection(), axis);
    if (next !== before) {
      change(next);
    }
  },
});
