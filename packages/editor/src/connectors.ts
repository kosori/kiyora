import {
  type Anchor,
  type Board,
  type ConnectorShape,
  detachConnector,
  type Endpoint,
  type Head,
  type Route,
} from '@kiyora/model';
import { markSourceStale } from './source-state';

/**
 * What the inspector may change about a connector: its route, the head at each
 * end, and whether each end names the edge it leaves from. The two ends are
 * chosen independently. A label is a shape's text and edits through the same
 * path as any other label.
 */
export type ConnectorEdit = {
  end?: Head;
  route?: Route;
  start?: Head;
  /**
   * Fixes the `from` end to an anchor, or, when `null`, returns it to
   * auto-picking. The `to` end is the same under its own key.
   */
  fromAnchor?: Anchor | null;
  toAnchor?: Anchor | null;
};

/** An end with `anchor` applied, or the same end when it already agrees. */
const withAnchor = (
  endpoint: Endpoint,
  anchor: Anchor | null | undefined
): Endpoint => {
  if (anchor === undefined || endpoint.kind !== 'bound') {
    return endpoint;
  }
  if (anchor === null) {
    return endpoint.anchor === undefined
      ? endpoint
      : { kind: 'bound', shapeId: endpoint.shapeId };
  }

  return { ...endpoint, anchor };
};

/** The board with one connector wearing `edit`, or the same board when it did not change. */
export const editConnector = (
  board: Board,
  id: string,
  edit: ConnectorEdit
): Board => {
  let changed = false;
  const shapes = board.shapes.map((shape) => {
    if (shape.id !== id || shape.kind !== 'connector') {
      return shape;
    }
    const from = withAnchor(shape.from, edit.fromAnchor);
    const to = withAnchor(shape.to, edit.toAnchor);
    const next: ConnectorShape = {
      ...shape,
      from,
      to,
      ...(edit.end === undefined ? {} : { end: edit.end }),
      ...(edit.route === undefined ? {} : { route: edit.route }),
      ...(edit.start === undefined ? {} : { start: edit.start }),
    };
    changed =
      next.end !== shape.end ||
      next.from !== shape.from ||
      next.route !== shape.route ||
      next.start !== shape.start ||
      next.to !== shape.to;

    return changed ? next : shape;
  });

  return changed ? { ...board, shapes } : board;
};

/**
 * The board without `ids`, and with every connector that was bound to one of
 * them freed at the point it last attached. The connector is not deleted: an
 * orphan that silently disappeared would be a user-visible lie, so it stays on
 * the board, visible, until its author rebinds or removes it.
 */
export const removeShapes = (board: Board, ids: readonly string[]): Board => {
  const doomed = new Set(ids);
  if (doomed.size === 0) {
    return board;
  }
  const kept = board.shapes.filter((shape) => !doomed.has(shape.id));
  if (kept.length === board.shapes.length) {
    return board;
  }

  const shapes = kept.map((shape) =>
    shape.kind === 'connector'
      ? detachConnector(shape, board.shapes, doomed)
      : shape
  );

  return markSourceStale(board, { ...board, shapes }, ids);
};
