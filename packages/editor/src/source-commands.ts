import {
  boundsOfShapes,
  type FrameShape,
  mapSource,
  type Shape,
  SOURCE_INSET,
  subtreeIds,
} from '@kiyora/model';
import type { StoreCore } from './store-core';

/**
 * What an apply did: it stamped the frame, it left the board alone because the
 * frame is stale and the caller must ask first, or it named no frame at all.
 */
export type SourceApply = 'applied' | 'missing' | 'needs-confirm';

/** Whether an apply may replace a stale frame without asking. */
export type SourceApplyOptions = {
  force?: boolean;
};

/** The commands that carry a frame's Source onto the board. */
export type SourceCommands = {
  /**
   * Applies `text` to the frame `frameId` names: the shapes its previous Source
   * generated are replaced, the new ones join the frame, and the text is stored
   * with them. One call is one gesture, so one undo takes the whole apply back.
   *
   * A stale frame is left untouched unless `force` is set, so a hand edit to a
   * generated shape is never discarded on a keystroke; the caller asks, and
   * cancelling simply does nothing.
   */
  applySource: (
    frameId: string,
    text: string,
    options?: SourceApplyOptions
  ) => SourceApply;
};

/** The frame `frameId` names, or `null` when no frame holds it. */
const frameOf = (
  shapes: readonly Shape[],
  frameId: string
): FrameShape | null => {
  const shape = shapes.find((one) => one.id === frameId);

  return shape?.kind === 'frame' ? shape : null;
};

/**
 * The frame grown to hold `generated` with the same inset the mapping left
 * around it. It only ever grows: a frame a person sized for a slide keeps that
 * size even when the next diagram is smaller or empty.
 */
const grownToFit = (
  frame: FrameShape,
  generated: readonly Shape[],
  context: readonly Shape[]
): FrameShape => {
  const box = boundsOfShapes(generated, context);
  if (box === null) {
    return frame;
  }
  const w = Math.max(frame.w, box.x + box.w + SOURCE_INSET - frame.x);
  const h = Math.max(frame.h, box.y + box.h + SOURCE_INSET - frame.y);

  return w === frame.w && h === frame.h ? frame : { ...frame, h, w };
};

/**
 * The Source commands' wiring: the one write funnel. The parser and the mapping
 * stay in `model`, so this module only decides what an apply replaces and what
 * the frame remembers.
 */
export const createSourceCommands = (core: StoreCore): SourceCommands => ({
  applySource: (frameId, text, options = {}) => {
    const board = core.board();
    const frame = frameOf(board.shapes, frameId);
    if (frame === null) {
      return 'missing';
    }
    if (frame.source?.stale === true && options.force !== true) {
      return 'needs-confirm';
    }

    const replaced = new Set(
      subtreeIds(board, frame.source?.generatedIds ?? [])
    );
    const kept = board.shapes.filter((shape) => !replaced.has(shape.id));
    const mapped = mapSource(text, frame, core.style(), kept);
    const generated = mapped.shapes;
    const updated: FrameShape = {
      ...grownToFit(frame, generated, [...kept, ...generated]),
      source: {
        generatedIds: generated.map((shape) => shape.id),
        stale: false,
        text,
      },
    };

    core.change({
      ...board,
      shapes: [
        ...kept.map((shape) => (shape.id === frame.id ? updated : shape)),
        ...generated,
      ],
    });

    return 'applied';
  },
});
