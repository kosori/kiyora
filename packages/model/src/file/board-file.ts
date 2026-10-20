import { migratePayload } from '../board/migrations';
import { type Board, boardSchema, SCHEMA_VERSION } from '../board/schema';
import { BoardRejection, parseBoard } from '../board/validate';
import { utf8Length } from '../format';

/** The extension a board file wears. */
export const BOARD_FILE_EXTENSION = '.kyr.json';

/**
 * The most bytes a board file may hold. A file is read into a string before it
 * is parsed, so the cap has to be checked before the read: a pick past it is
 * refused instead of turning the tab into a frozen one. Generous, like the
 * export caps, because a board with many labelled shapes is still small.
 */
export const BOARD_FILE_LIMIT_BYTES = 8 * 1024 * 1024;

/**
 * Thrown when a board file is past the byte cap. It is a Fault, not a rejection:
 * the bytes are not wrong, there are merely too many of them, and the size that
 * broke the cap travels with it so the surface can tell the person which file to
 * shrink. Nothing is parsed and nothing is returned, so a partial board can
 * never stand in for the one on disk.
 */
export class BoardFileFault extends Error {
  readonly bytes: number;
  readonly limit: number;

  constructor(bytes: number, limit = BOARD_FILE_LIMIT_BYTES) {
    super(`board file refused: ${bytes} bytes is over the ${limit}-byte cap`);
    this.name = 'BoardFileFault';
    this.bytes = bytes;
    this.limit = limit;
  }
}

/**
 * The board as the bytes a file holds: one JSON document, keys in the schema's
 * order, no whitespace. Autosave and the board file share this serializer, so
 * what is stored and what is saved cannot drift into two shapes. It always
 * writes the running version, so a file lifted on open is saved as the newest
 * record and migrates once.
 */
export const serializeBoard = (board: Board): string =>
  JSON.stringify(boardSchema.parse(board));

type ParsedJson = { ok: true; value: unknown } | { ok: false; reason: string };

/** Parses JSON without throwing, so a bad file can be reported rather than raised. */
const parseJson = (bytes: string): ParsedJson => {
  try {
    return { ok: true, value: JSON.parse(bytes) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Reads a board out of a board file's bytes. Bytes past the cap raise a
 * `BoardFileFault` before anything is parsed; bytes that are not JSON, or whose
 * payload will not lift, raise a `BoardRejection` naming what was wrong. A board
 * from an older release runs the same migration chain autosave runs, and one
 * from a newer release is refused rather than guessed at.
 */
export const parseBoardFile = (bytes: string): Board => {
  const size = utf8Length(bytes);
  if (size > BOARD_FILE_LIMIT_BYTES) {
    throw new BoardFileFault(size);
  }

  const parsed = parseJson(bytes);
  if (!parsed.ok) {
    throw new BoardRejection([
      { message: `is not valid JSON: ${parsed.reason}`, path: 'file' },
    ]);
  }

  const lifted = migratePayload(parsed.value);
  if (lifted.status === 'newer') {
    throw new BoardRejection([
      {
        message: `is version ${lifted.version}; this build writes ${SCHEMA_VERSION}`,
        path: 'schemaVersion',
      },
    ]);
  }
  if (lifted.status === 'unreadable') {
    throw new BoardRejection([
      { message: 'is not a board this build can lift', path: 'file' },
    ]);
  }

  return parseBoard(lifted.payload);
};
