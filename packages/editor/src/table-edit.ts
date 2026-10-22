import type { Board, TableCell } from '@kiyora/model';
import type { Transactions } from './history/transaction';
import {
  addShapeTableColumn,
  addShapeTableRow,
  setShapeTableCell,
  setShapeTableHeader,
} from './shape-edit';

/**
 * The table edits the editor exposes: one cell's text and the three structure
 * edits the Inspector offers. A cell write joins the open label edit, so typing
 * into a cell is one gesture and one undo; a structure edit is a gesture of its
 * own.
 */
export type TableEdit = {
  /** Adds one empty row as one gesture. */
  addRow: (id: string) => void;
  /** Adds one empty column as one gesture. */
  addColumn: (id: string) => void;
  /** Turns the header row on or off as one gesture. */
  setHeader: (id: string, headerRow: boolean) => void;
  /**
   * Writes one cell's text, joining the open edit or — outside one — standing as
   * its own gesture, so no table write is invisible to the history.
   */
  setCell: (id: string, cell: TableCell, text: string) => void;
};

/** The table edits' wiring: which board, how a change lands, and where it is recorded. */
type Options = {
  /** The board as it stands. */
  board: () => Board;
  /** Adopts a board as one gesture: one history entry, one save. */
  change: (next: Board) => void;
  /** Adopts a board that may not have changed, waking only the board's subscribers. */
  publish: (next: Board) => void;
  /** The transactions the cell edit's open span and its one entry belong to. */
  transactions: Transactions;
};

/**
 * The table edits, wired to the store's board. A cell edit is the same gesture a
 * label edit is; the structure edits are single writes with one history entry
 * each, so adding a row and undoing it puts the grid back exactly.
 */
export const createTableEdit = ({
  board,
  change,
  publish,
  transactions,
}: Options): TableEdit => ({
  addColumn: (id) => {
    change(addShapeTableColumn(board(), id));
  },
  addRow: (id) => {
    change(addShapeTableRow(board(), id));
  },
  setCell: (id, cell, text) => {
    transactions.endNudgeRun();
    const editing = transactions.isEditing();
    const before = board();
    if (!editing) {
      transactions.beginEdit(before);
    }
    publish(setShapeTableCell(board(), id, cell, text));
    if (!editing) {
      transactions.endEdit(board());
    }
  },
  setHeader: (id, headerRow) => {
    change(setShapeTableHeader(board(), id, headerRow));
  },
});
