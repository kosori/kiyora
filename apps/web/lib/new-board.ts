import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';

/** The title a board carries until it is renamed. */
export const UNTITLED = 'Untitled';

/**
 * A new, empty board with `id`. Nothing is seeded: a new board paints nothing
 * until something is drawn. `createdAt` and `updatedAt` are the same instant,
 * so the first save is the first change.
 *
 * `now` is the instant both times carry, defaulted here so a test or a duplicate
 * can pin it. `title` defaults to `UNTITLED`; the schema accepts `''`, so a
 * caller passing an empty string gets a board that looks untitled but carries no
 * name.
 *
 * @throws {BoardRejection} when the literals below no longer satisfy the board
 * schema, which is how a required field added by a schema bump reaches a caller.
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
 * A board id minted in this browser, before anything is stored: a board never
 * needs a server to have an identity. `crypto.randomUUID` exists only in a
 * secure context, so an insecure origin falls back to `getRandomValues` and
 * formats a UUID-v4-shaped id itself — the shape the remote schema stores. The
 * presence handshake mints its tab id the same way.
 */
export const mintBoardId = (): string => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const view = new DataView(bytes.buffer);
  // RFC 4122: the version nibble is 4 and the variant's top bits are 10.
  view.setUint8(6, (view.getUint8(6) % 16) + 0x40);
  view.setUint8(8, (view.getUint8(8) % 64) + 0x80);
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/**
 * A board created by a person. Its id is minted here, in the browser, before it
 * is stored anywhere: a board never needs a server to have an identity.
 */
export const newBoard = (): Board => emptyBoard(mintBoardId());
