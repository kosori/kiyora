import type { Board, Shape } from '@kiyora/model';

/**
 * The shapes whose own authored text contains `query`, case-insensitively, in
 * paint order. A shape is searched by the words a person typed into it — its
 * label, a Sticky's text, a Frame's title or a Connector's label — and never by
 * the runs, wraps or glyphs paint derives from them. A shape with no text is
 * not a match, and neither is a Frame's Source, which is code rather than a
 * label. A locked shape is still found: the lock protects its geometry, not
 * who may see it.
 *
 * A group and its members are separate shapes with separate text, so a match
 * on a member selects that member rather than the group that holds it.
 */
export const findMatches = (board: Board, query: string): Shape[] => {
  if (query === '') {
    return [];
  }
  const needle = query.toLowerCase();

  return board.shapes.filter((shape) =>
    shape.text?.toLowerCase().includes(needle)
  );
};
