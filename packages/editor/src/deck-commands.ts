import {
  addSlide as addSlideToBoard,
  type Board,
  DECK_TEMPLATES,
  deleteSlide as deleteSlideFromBoard,
  duplicateSlide as duplicateSlideOnBoard,
  insertTemplateSlide,
  moveSlide as moveSlideInBoard,
  type Style,
  setSlideNotes as setNotesOnBoard,
  toggleSlideSkipped,
} from '@kiyora/model';

/** The deck edits the editor exposes. Each one is a single board change. */
export type DeckCommands = {
  addSlide: (frameId: string) => void;
  addSlideFromTemplate: (templateId: string) => void;
  deleteSlide: (frameId: string) => void;
  duplicateSlide: (frameId: string) => void;
  moveSlide: (frameId: string, to: number) => void;
  setSlideNotes: (frameId: string, notes: string) => void;
  toggleSlideSkip: (frameId: string) => void;
};

type Options = {
  /** The board as it stands. */
  board: () => Board;
  /** Adopts a changed board as one gesture: one history entry, one save. */
  change: (next: Board) => void;
  /** The style a template's shapes wear: the board's last used one. */
  style: () => Style;
};

/**
 * The deck edits, wired to the store's board and its one-gesture commit. Every
 * board shape of a deck change lives in the model, so this module is only the
 * wiring: which board, which commit, whose style.
 */
export const createDeckCommands = ({
  board,
  change,
  style,
}: Options): DeckCommands => ({
  addSlide: (frameId) => change(addSlideToBoard(board(), frameId)),
  addSlideFromTemplate: (templateId) => {
    const template = DECK_TEMPLATES.find((entry) => entry.id === templateId);
    if (template === undefined) {
      return;
    }
    change(insertTemplateSlide(board(), template, style()));
  },
  deleteSlide: (frameId) => change(deleteSlideFromBoard(board(), frameId)),
  duplicateSlide: (frameId) => change(duplicateSlideOnBoard(board(), frameId)),
  moveSlide: (frameId, to) => change(moveSlideInBoard(board(), frameId, to)),
  setSlideNotes: (frameId, notes) =>
    change(setNotesOnBoard(board(), frameId, notes)),
  toggleSlideSkip: (frameId) => change(toggleSlideSkipped(board(), frameId)),
});
