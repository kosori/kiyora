import {
  type FrameShape,
  mapSource,
  type Shape,
  subtreeIds,
} from '@kiyora/model';
import type { StoreCore } from './store-core';

/** The commands that carry a frame's Source onto the board. */
export type SourceCommands = {
  /**
   * Applies `text` to the frame `frameId` names: the shapes its previous Source
   * generated are replaced, the new ones join the frame, and the text is stored
   * with them. One call is one gesture, so one undo takes the whole apply back.
   */
  applySource: (frameId: string, text: string) => void;
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
 * The Source commands' wiring: the one write funnel. The parser and the mapping
 * stay in `model`, so this module only decides what an apply replaces and what
 * the frame remembers.
 */
export const createSourceCommands = (core: StoreCore): SourceCommands => ({
  applySource: (frameId, text) => {
    const board = core.board();
    const frame = frameOf(board.shapes, frameId);
    if (frame === null) {
      return;
    }

    const replaced = new Set(
      subtreeIds(board, frame.source?.generatedIds ?? [])
    );
    const kept = board.shapes.filter((shape) => !replaced.has(shape.id));
    const mapped = mapSource(text, frame, core.style(), kept);
    const generated = mapped.shapes;
    const updated: FrameShape = {
      ...frame,
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
  },
});
