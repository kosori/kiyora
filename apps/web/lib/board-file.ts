import {
  BOARD_FILE_EXTENSION,
  BOARD_FILE_LIMIT_BYTES,
  type Board,
  BoardFileFault,
  parseBoardFile,
  serializeBoard,
} from '@kiyora/model';
import { downloadBlob } from './download';

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

/**
 * Thrown when the browser could not read a picked file's bytes. It carries the
 * file's name, so the surface can name the file that failed instead of showing
 * a platform `DOMException` verbatim.
 */
export class BoardFileReadFault extends Error {
  readonly fileName: string;

  constructor(fileName: string, options?: ErrorOptions) {
    super(`the board file "${fileName}" could not be read`, options);
    this.name = 'BoardFileReadFault';
    this.fileName = fileName;
  }
}

/**
 * Thrown when a board could not be written out as a file. Serializing can
 * refuse a board that no longer satisfies the schema and the browser can refuse
 * the blob, so the failure is part of the contract rather than an uncaught
 * throw inside a click handler.
 */
export class BoardFileWriteFault extends Error {
  constructor(options?: ErrorOptions) {
    super('the board could not be written as a file', options);
    this.name = 'BoardFileWriteFault';
  }
}

/**
 * Writes `board` out as one `.kyr.json` download, the board's own bytes.
 *
 * @throws {BoardFileWriteFault} when the board cannot be serialized or the
 * browser refuses the download, with a message the caller can report.
 */
export const saveBoardFile = (board: Board): void => {
  try {
    const url = URL.createObjectURL(
      new Blob([serializeBoard(board)], { type: 'application/json' })
    );
    downloadBlob(url, boardFileName(board.title));
  } catch (error) {
    // biome-ignore lint/style/useErrorCause: the cause is handed to `Error.cause` by BoardFileWriteFault's constructor.
    throw new BoardFileWriteFault({ cause: error });
  }
};

/**
 * Reads the board a person picked. A file past the byte cap is refused before
 * its bytes are read into a string, so a huge pick reports a Fault instead of
 * freezing the tab; a read the browser refuses reports a fault naming the file,
 * and any parse refusal names what was wrong and leaves the open board alone.
 */
export const openBoardFile = async (file: File): Promise<Board> => {
  if (file.size > BOARD_FILE_LIMIT_BYTES) {
    throw new BoardFileFault(file.size);
  }

  let bytes: string;
  try {
    bytes = await file.text();
  } catch (error) {
    throw new BoardFileReadFault(file.name, { cause: error });
  }

  return parseBoardFile(bytes);
};
