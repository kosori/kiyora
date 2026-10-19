import { type Board, parseBoard } from '@kiyora/model';
import type { Editor } from '../store';
import type { BoardStorage } from './storage';

/**
 * Reads the board this browser last saved, or null when there is nothing to
 * read. Bytes that will not parse are treated as absent; the version check, the
 * migrations and the quarantine all slot in here, before anything trusts the
 * bytes.
 */
export const loadBoard = async (
  storage: BoardStorage
): Promise<Board | null> => {
  const raw = await storage.read();
  if (raw === null) {
    return null;
  }
  try {
    return parseBoard(JSON.parse(raw));
  } catch {
    return null;
  }
};

/**
 * Opens `board` in the engine, bringing the view back to where the board was
 * left. The camera is in the board but not in its history, so restoring it is a
 * view change, not a board change, and never arms a save.
 */
export const restoreBoard = (editor: Editor, board: Board): void => {
  editor.setBoard(board);
  editor.setCamera(board.camera);
};
