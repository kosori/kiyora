import type { Board, IconSet } from '@kiyora/model';

/**
 * The icon dataset's one loader. The module is fetched through a dynamic
 * import, so it becomes its own chunk and never reaches the first paint; the
 * promise is kept, so the canvas, the picker and an export share one fetch.
 *
 * The import specifier is the package's `./icons` entry rather than a path into
 * `model`'s source, which keeps the dataset out of the model's public entry and
 * makes an accidental static import visible in review.
 */
type IconModule = typeof import('@kiyora/model/icons');

let pending: Promise<IconModule> | undefined;

/** The icon dataset, fetched once and shared from then on. */
export const loadIconModule = (): Promise<IconModule> => {
  if (pending !== undefined) {
    return pending;
  }

  const loading = import('@kiyora/model/icons').catch((error: unknown) => {
    // A failed chunk load is transient: clearing it lets the next caller retry
    // instead of caching the rejection for the rest of the session.
    pending = undefined;
    throw error;
  });
  pending = loading;

  return loading;
};

/** Whether a board draws anything from the dataset, so a fetch has a reason. */
export const boardUsesIcons = (board: Board): boolean =>
  board.shapes.some((shape) => shape.kind === 'icon');

/** The dataset a board's export needs, or none when nothing names an icon. */
export const iconSetFor = async (board: Board): Promise<IconSet | undefined> =>
  boardUsesIcons(board) ? (await loadIconModule()).ICONS : undefined;
