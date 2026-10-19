import {
  BOARD_FILE_EXTENSION,
  type Board,
  parseBoardFile,
  serializeBoard,
} from '@kiyora/model';

/** The file a board is saved under: its title, slugged, with the board extension. */
export const boardFileName = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'board'}${BOARD_FILE_EXTENSION}`;
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

/** Reads the board a person picked, naming what was wrong when the file is not one. */
export const openBoardFile = async (file: File): Promise<Board> =>
  parseBoardFile(await file.text());
