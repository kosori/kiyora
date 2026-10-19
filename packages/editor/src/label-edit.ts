import type { Board, Measurer, Shape, TextStyle } from '@kiyora/model';
import type { Transactions } from './history/transaction';
import { setShapeText, setShapeTextStyle } from './shape-edit';

/**
 * The label edits the editor exposes: the open edit's span, the two writes that
 * land in it, and the placement that can hand it over. A label edit is a
 * gesture like a drag — it opens when the overlay appears, every write joins it,
 * and it commits once when the edit ends — so finishing one is one undo, and the
 * box a sticky grew into travels back with its words.
 */
export type LabelEdit = {
  /** Opens the edit's transaction, or joins the one already open. */
  begin: () => void;
  /** Commits the open edit as one entry. Does nothing when none is open. */
  end: () => void;
  /** The board a cancelled edit began on, dropped without committing; `null` when none was open. */
  cancel: () => Board | null;
  /**
   * Writes one shape's label, joining the open edit or — outside one — standing
   * as its own gesture, so no board write is invisible to the history. A sticky
   * grows to fit the words when a measurer is supplied.
   */
  setText: (id: string, text: string, measure?: Measurer) => void;
  /** Writes one shape's text style as one gesture. */
  setTextStyle: (id: string, textStyle: TextStyle) => void;
  /**
   * Records a placement: as one entry, or — for a shape whose label overlay
   * opens the moment it lands — as the open edit the words typed into it are
   * part of, so placing a text shape and typing its label is one undo, not two.
   */
  place: (before: Board, shape: Shape, placed: Board) => void;
};

/** Whether a shape's placement is followed at once by the overlay that labels it. */
const opensLabel = (shape: Shape): boolean =>
  shape.kind === 'text' || shape.kind === 'sticky';

/** The label edit's wiring: which board, how a change lands, and where it is recorded. */
type Options = {
  /** The board as it stands. */
  board: () => Board;
  /** Adopts a board as one gesture: one history entry, one save. */
  change: (next: Board) => void;
  /** Adopts a board that may not have changed, waking only the board's subscribers. */
  publish: (next: Board) => void;
  /** The transactions the edit's open span and its one entry belong to. */
  transactions: Transactions;
};

/**
 * The label edits, wired to the store's board. The store holds the behaviour of
 * a gesture; this holds the one gesture that is the text a person types.
 */
export const createLabelEdit = ({
  board,
  change,
  publish,
  transactions,
}: Options): LabelEdit => ({
  begin: () => {
    transactions.beginEdit(board());
  },
  cancel: () => transactions.cancelEdit(),
  end: () => {
    transactions.endEdit(board());
  },
  place: (before, shape, placed) => {
    if (opensLabel(shape)) {
      transactions.beginEdit(before);
    } else {
      transactions.commit(before, placed);
    }
  },
  setText: (id, text, measure) => {
    transactions.endNudgeRun();
    const editing = transactions.isEditing();
    const before = board();
    if (!editing) {
      transactions.beginEdit(before);
    }
    publish(setShapeText(board(), id, text, measure));
    if (!editing) {
      transactions.endEdit(board());
    }
  },
  setTextStyle: (id, textStyle) => {
    change(setShapeTextStyle(board(), id, textStyle));
  },
});
