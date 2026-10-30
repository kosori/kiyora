import {
  type Board,
  type Endpoint,
  SCHEMA_VERSION,
  type Shape,
  shapeSchema,
  subtreeIds,
} from '@kiyora/model';
import { movedShape } from './shape-edit';

/**
 * Copying: a set of shapes lifted off the board and put back with fresh ids.
 * The clipboard is plain board data, so another tab can take it over the board
 * channel without inventing a second format; nothing here touches the network.
 */

/** A copied set of shapes, held apart from the board until it is pasted. */
export type Clipboard = {
  shapes: Shape[];
};

/** The schema version a clipboard message is written at. */
export const CLIPBOARD_VERSION = SCHEMA_VERSION;

/**
 * One tab's clipboard as it crosses the board channel. It carries the shape
 * records themselves rather than ids or pixels, so the receiving tab can re-id
 * them against its own board. `schemaVersion` is the sender's, because two tabs
 * may be running different builds.
 */
export type ClipboardMessage = {
  type: 'clipboard';
  /** The board it was copied from, so another board's relay refuses it. */
  boardId: string;
  /** The tab that copied it, so a tab never takes back its own broadcast. */
  origin: string;
  schemaVersion: number;
  shapes: Shape[];
};

/** Whether `endpoint` is bound to one of `wanted`. */
const boundTo = (wanted: ReadonlySet<string>, endpoint: Endpoint): boolean =>
  endpoint.kind === 'bound' && wanted.has(endpoint.shapeId);

/**
 * `fragment` as the part another tab can carry: a connector whose bound end
 * names a shape outside the fragment is dropped. A same-board paste can keep
 * that binding because the shape is still there; another tab has no such shape,
 * so carrying the connector would draw a line to nothing. A connector between
 * two copied shapes stays, and a free end still travels with its copy.
 */
export const portableFragment = (fragment: Clipboard): Clipboard => {
  const carried = new Set(fragment.shapes.map((shape) => shape.id));

  return {
    shapes: fragment.shapes.filter(
      (shape) =>
        shape.kind !== 'connector' ||
        ((boundTo(carried, shape.from) || shape.from.kind === 'free') &&
          (boundTo(carried, shape.to) || shape.to.kind === 'free'))
    ),
  };
};

/** `fragment` as the message a tab broadcasts to the others on `boardId`. */
export const clipboardMessage = (
  fragment: Clipboard,
  { boardId, origin }: { boardId: string; origin: string }
): ClipboardMessage => ({
  boardId,
  origin,
  schemaVersion: CLIPBOARD_VERSION,
  shapes: portableFragment(fragment).shapes,
  type: 'clipboard',
});

const fragments = shapeSchema.array();

/**
 * `input` as a clipboard `boardId` can paste, or `null` when it is not. A
 * version other than this build's is refused rather than migrated: migrations
 * lift whole boards, and a fragment arrives with no board around it to reason
 * about. A fragment copied in another board is refused too, so a paste never
 * lands in the wrong document. Every shape is validated, so a message cannot
 * put a record the schema rejects on the board.
 */
export const readClipboardMessage = (
  input: unknown,
  boardId: string
): Clipboard | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const message = input as Record<string, unknown>;
  if (
    message.type !== 'clipboard' ||
    message.boardId !== boardId ||
    message.schemaVersion !== CLIPBOARD_VERSION
  ) {
    return null;
  }
  const parsed = fragments.safeParse(message.shapes);
  if (!parsed.success || parsed.data.length === 0) {
    return null;
  }

  return { shapes: parsed.data };
};

/**
 * Where a copy lands relative to what it copies, in board units: three grid
 * steps, so a pasted copy is visibly its own shape rather than hidden behind
 * the original.
 */
export const COPY_OFFSET = 24;

/** The first `<kind>-<n>` id `used` does not hold, recorded in `used`. */
const mintId = (kind: Shape['kind'], used: Set<string>): string => {
  let n = 1;
  while (used.has(`${kind}-${n}`)) {
    n += 1;
  }
  const id = `${kind}-${n}`;
  used.add(id);

  return id;
};

/**
 * `ids` and everything held inside them, as a fragment. A frame arrives with
 * its members, found through the containment helper rather than a second walk,
 * and a connector whose two ends both land on copied shapes comes too, even
 * when it was not selected — so a connector between two copied shapes stays
 * between the two copies. A shape whose parent is not part of the fragment is
 * re-rooted, so a pasted copy never names a parent the copy does not have.
 */
export const copyFragment = (
  board: Board,
  ids: readonly string[]
): Clipboard => {
  const wanted = new Set(subtreeIds(board, ids));
  for (const shape of board.shapes) {
    if (
      shape.kind === 'connector' &&
      !wanted.has(shape.id) &&
      boundTo(wanted, shape.from) &&
      boundTo(wanted, shape.to)
    ) {
      wanted.add(shape.id);
    }
  }

  return {
    shapes: board.shapes
      .filter((shape) => wanted.has(shape.id))
      .map((shape) =>
        shape.parentId !== null && !wanted.has(shape.parentId)
          ? { ...shape, parentId: null }
          : shape
      ),
  };
};

/** A fragment put back on the board, with the ids it was minted. */
export type Paste = {
  board: Board;
  /** The ids the copy wears, so a caller can select what it just pasted. */
  ids: string[];
};

/**
 * Puts `fragment` on the board offset by `dx`, `dy`. Every copy gets a fresh
 * id; a copied member's `parentId` is remapped to the copy of its parent; and a
 * connector whose end was bound to a copied shape is rebound to that shape's
 * copy — so a connector copied with the two shapes it joins stays joined to the
 * copies, not to the originals. An end bound to a shape left behind keeps its
 * binding, and a free end travels with the copy.
 */
export const pasteFragment = (
  board: Board,
  fragment: Clipboard,
  dx: number,
  dy: number
): Paste => {
  if (fragment.shapes.length === 0) {
    return { board, ids: [] };
  }

  const used = new Set(board.shapes.map((shape) => shape.id));
  const remap = new Map<string, string>();
  for (const shape of fragment.shapes) {
    remap.set(shape.id, mintId(shape.kind, used));
  }

  const rebind = (endpoint: Endpoint): Endpoint => {
    if (endpoint.kind !== 'bound') {
      return endpoint;
    }
    const id = remap.get(endpoint.shapeId);

    return id === undefined ? endpoint : { ...endpoint, shapeId: id };
  };

  const copies: Shape[] = [];
  for (const shape of fragment.shapes) {
    const id = remap.get(shape.id);
    if (id === undefined) {
      continue;
    }
    const parentId =
      shape.parentId === null
        ? null
        : (remap.get(shape.parentId) ?? shape.parentId);
    const copy: Shape =
      shape.kind === 'connector'
        ? {
            ...shape,
            from: rebind(shape.from),
            id,
            parentId,
            to: rebind(shape.to),
          }
        : { ...shape, id, parentId };
    copies.push(movedShape(copy, dx, dy));
  }

  return {
    board: { ...board, shapes: [...board.shapes, ...copies] },
    ids: copies.map((shape) => shape.id),
  };
};

/**
 * The board with `ids` and everything they hold copied clear of themselves. One
 * call, one board, so a caller commits it as one gesture.
 */
export const duplicateShapes = (board: Board, ids: readonly string[]): Paste =>
  pasteFragment(board, copyFragment(board, ids), COPY_OFFSET, COPY_OFFSET);
