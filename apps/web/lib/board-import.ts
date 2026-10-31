import { createLibrary, type LibraryEntry } from '@kiyora/editor';
import { openBoardFile } from './board-file';
import { openStore } from './board-storage';

/**
 * Reads `file` as a board and adds it to the library, leaving the board that is
 * open exactly as it was. The file's id is kept unless the library already
 * holds it. Returns the entry as stored, or throws the refusal that stopped it.
 */
export const importBoardFile = async (file: File): Promise<LibraryEntry> => {
  const board = await openBoardFile(file);
  const { store } = await openStore();
  return createLibrary(store).importBoard(board);
};
