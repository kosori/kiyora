import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';

/** The title a board carries until it is renamed. */
export const UNTITLED = 'Untitled';

/**
 * A new, empty board with `id`. Nothing is seeded: a new board paints nothing
 * until something is drawn. `createdAt` and `updatedAt` are the same instant,
 * so the first save is the first change.
 */
export const emptyBoard = (
  id: string,
  now = Date.now(),
  title = UNTITLED
): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    deck: [],
    files: {},
    id,
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [],
    title,
    updatedAt: now,
  });

/**
 * A board created by a person. Its id is minted here, in the browser, before it
 * is stored anywhere: a board never needs a server to have an identity.
 */
export const newBoard = (): Board => emptyBoard(crypto.randomUUID());
