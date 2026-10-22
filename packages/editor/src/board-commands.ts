import { type Board, type Shape, subtreeIds } from '@kiyora/model';
import { type ConnectorEdit, editConnector } from './connectors';
import { addShape } from './containment';
import type { Gestures } from './gestures';
import type { LabelEdit } from './label-edit';
import { type OrderMove, reorderedBoard } from './ordering';
import type { Placement } from './placement';
import { shapeFromPlacement } from './placement';
import { type Restyle, restyledBoard } from './restyle';
import { selectedShapes } from './selection';
import { translateShapes } from './shape-edit';
import type { StoreCore } from './store-core';
import { placesShape } from './tools';

/** The board edits the editor exposes beside its gestures: the history and the one-shape writes. */
export type BoardCommands = {
  /** Moves every selected shape by the same delta, so relative positions hold. */
  nudge: (dx: number, dy: number) => void;
  /**
   * Restyles every selected shape in one board write: a style patch, an
   * opacity, a text-style patch, or any combination. One call is one gesture,
   * so it is one history entry.
   */
  restyle: (change: Restyle) => void;
  /**
   * Locks or unlocks every selected shape as one gesture. A selection already
   * wearing the asked-for lock writes nothing.
   */
  setLocked: (locked: boolean) => void;
  /** Moves the selection in paint order as one gesture, writing nothing when it cannot move. */
  reorder: (move: OrderMove) => void;
  /** Replaces the board and notifies every board subscriber. */
  setBoard: (board: Board) => void;
  /**
   * Changes a connector's route or the head at one end. One call is one
   * gesture, so it is one history entry.
   */
  setConnector: (id: string, edit: ConnectorEdit) => void;
  /**
   * Places the active shape tool's shape in `placement`'s box, wearing the last
   * used style, and returns it so a caller can begin editing a text shape at
   * once, or `null` for a tool that places nothing.
   */
  placeShape: (placement: Placement) => Shape | null;
  /** Undoes the last committed gesture. Does nothing when there is none. */
  undo: () => void;
  /** Redoes the last undone gesture. Does nothing when there is none. */
  redo: () => void;
  /** Drops the open label edit and restores the board it began on, pushing nothing. */
  cancelTextEdit: () => void;
};

/** The board commands' wiring: the core they write through, the gestures they close, and the label they can hand over. */
type Options = {
  core: StoreCore;
  gestures: Gestures;
  label: LabelEdit;
};

/**
 * The board edits that are not gestures: the history, the nudge, the restyle,
 * the connector and the placement. Each one writes through the core, so each
 * one is still one history entry and one save, and none of them knows how a
 * pointer move becomes a board.
 */
export const createBoardCommands = ({
  core,
  gestures,
  label,
}: Options): BoardCommands => {
  /** Opens the board `next` replaces, keeping the selection honest and repainting. */
  const restore = (next: Board | null): void => {
    if (next === null) {
      return;
    }
    gestures.abandon();
    core.adopt(next);
    core.select(core.selection());
  };

  return {
    cancelTextEdit: () => {
      restore(label.cancel());
    },
    nudge: (dx, dy) => {
      const board = core.board();
      const ids = selectedShapes(board, subtreeIds(board, core.selection()))
        .filter((shape) => !shape.locked)
        .map((shape) => shape.id);
      if (ids.length === 0) {
        return;
      }
      core.transactions.noteNudge(board);
      core.publish(translateShapes(board, ids, dx, dy));
    },
    placeShape: (placement) => {
      const { tool } = core.view();
      if (!placesShape(tool)) {
        return null;
      }
      core.transactions.endNudgeRun();
      const before = core.board();
      const shape = shapeFromPlacement(
        tool,
        placement,
        core.style(),
        before.shapes
      );
      core.adopt(addShape(before, shape));
      core.setView({ ...core.view(), tool: 'select' });
      label.place(before, shape, core.board());
      return shape;
    },
    redo: () => {
      restore(core.transactions.redo(core.board()));
    },
    reorder: (move) => {
      const next = reorderedBoard(core.board(), core.selection(), move);
      if (next !== null) {
        core.change(next);
        core.select(core.selection());
      }
    },
    restyle: (change) => {
      const result = restyledBoard(core.board(), core.selection(), change);
      if (result === null) {
        return;
      }
      const { board: nextBoard, style: nextStyle } = result;
      core.change(nextBoard);
      if (nextStyle !== undefined) {
        core.setStyle(nextStyle);
      }
    },
    setBoard: (next) => {
      core.transactions.endNudgeRun();
      core.adopt(next);
      core.select(core.selection());
      core.transactions.clear();
    },
    setConnector: (id, edit) => {
      core.change(editConnector(core.board(), id, edit));
    },
    setLocked: (locked) => {
      const board = core.board();
      const ids = new Set(core.selection());
      let changed = false;
      const shapes = board.shapes.map((shape) => {
        if (!ids.has(shape.id) || shape.locked === locked) {
          return shape;
        }
        changed = true;
        return { ...shape, locked };
      });
      if (changed) {
        core.change({ ...board, shapes });
      }
    },
    undo: () => {
      restore(core.transactions.undo(core.board()));
    },
  };
};
