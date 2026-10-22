import {
  BOARD_FILE_EXTENSION,
  BOARD_FILE_LIMIT_BYTES,
  type Board,
  BoardFileFault,
  parseBoardFile,
  serializeBoard,
} from '@kiyora/model';

/** The file a board is saved under: its title, slugged, with the given extension. */
export const boardFileName = (
  title: string,
  extension = BOARD_FILE_EXTENSION
): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'board'}${extension}`;
};

/** Writes `board` out as one `.kyr.json` download, the board's own bytes. */
export const saveBoardFile = (board: Board): void => {
  const url = URL.createObjectURL(
    new Blob([serializeBoard(board)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.download = boardFileName(board.title);
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Reads the board a person picked. A file past the byte cap is refused before
 * its bytes are read into a string, so a huge pick reports a Fault instead of
 * freezing the tab; any other refusal names what was wrong and leaves the open
 * board alone.
 */
export const openBoardFile = async (file: File): Promise<Board> => {
  if (file.size > BOARD_FILE_LIMIT_BYTES) {
    throw new BoardFileFault(file.size);
  }
  return parseBoardFile(await file.text());
};
