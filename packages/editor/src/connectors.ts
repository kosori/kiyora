import {
  type Board,
  type ConnectorShape,
  detachConnector,
  type Head,
  type Route,
} from '@kiyora/model';

/**
 * What the inspector may change about a connector: its route and the head at
 * each end, chosen independently. A label is a shape's text and edits through
 * the same path as any other label.
 */
export type ConnectorEdit = {
  end?: Head;
  route?: Route;
  start?: Head;
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
    const next: ConnectorShape = {
      ...shape,
      ...(edit.end === undefined ? {} : { end: edit.end }),
      ...(edit.route === undefined ? {} : { route: edit.route }),
      ...(edit.start === undefined ? {} : { start: edit.start }),
    };
    changed =
      next.end !== shape.end ||
      next.route !== shape.route ||
      next.start !== shape.start;

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

  return { ...board, shapes };
};
