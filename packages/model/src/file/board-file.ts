import { type Board, boardSchema } from '../board/schema';
import { BoardRejection, parseBoard } from '../board/validate';

/** The extension a board file wears. */
export const BOARD_FILE_EXTENSION = '.kyr.json';

/**
 * The board as the bytes a file holds: one JSON document, keys in the schema's
 * order, no whitespace. Autosave and the board file share this serializer, so
 * what is stored and what is saved cannot drift into two shapes.
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
 * Reads a board out of a board file's bytes. The two ways a file can be wrong —
 * it is not JSON, or it is JSON that is not a board — both raise a
 * `BoardRejection` whose message names what was wrong.
 */
export const parseBoardFile = (bytes: string): Board => {
  const parsed = parseJson(bytes);
  if (!parsed.ok) {
    throw new BoardRejection([
      { message: `is not valid JSON: ${parsed.reason}`, path: 'file' },
    ]);
  }
  return parseBoard(parsed.value);
};
