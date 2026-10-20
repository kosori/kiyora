import type { Board, Source } from '@kiyora/model';

/**
 * The two states a Source can be in, kept apart because one is about the text
 * and the other about the board. `pending` means the draft differs from the
 * text that was applied; `stale` means a generated shape has been edited since
 * that apply. A frame can be both at once.
 */
export type SourceState = {
  pending: boolean;
  stale: boolean;
};

/**
 * The state of a frame's Source beside the text a person is typing. Pending is
 * a comparison with the applied text, so it needs no second flag on the board
 * and clears the moment the draft matches. Stale is the frame's own flag.
 */
export const sourceState = (
  source: Source | undefined,
  draft: string
): SourceState => ({
  pending: draft !== (source?.text ?? ''),
  stale: source?.stale === true,
});

/**
 * The board with every frame whose Source generated one of `ids` marked stale.
 * The mutation that touched those ids names them, so staleness is a fact the
 * edit records rather than one a board diff has to infer. Only ids whose shape
 * actually changed count, which keeps a locked shape in a transform selection
 * from marking a frame it never touched.
 */
export const markSourceStale = (
  before: Board,
  after: Board,
  ids: Iterable<string>
): Board => {
  const previous = new Map(before.shapes.map((shape) => [shape.id, shape]));
  const current = new Map(after.shapes.map((shape) => [shape.id, shape]));
  const touched = new Set(
    [...ids].filter((id) => previous.get(id) !== current.get(id))
  );
  if (touched.size === 0) {
    return after;
  }

  let changed = false;
  const shapes = after.shapes.map((shape) => {
    if (
      shape.kind !== 'frame' ||
      shape.source === undefined ||
      shape.source.stale ||
      !shape.source.generatedIds.some((id) => touched.has(id))
    ) {
      return shape;
    }
    changed = true;
    return { ...shape, source: { ...shape.source, stale: true } };
  });

  return changed ? { ...after, shapes } : after;
};
