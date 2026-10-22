import type { StickyShape } from '../board/schema';
import type { Style } from '../board/shape-base';

import { TEXT_LINE_HEIGHT, TEXT_PADDING } from '../text/layout';
import { parseRuns } from '../text/markdown';
import { DEFAULT_TEXT_STYLE } from '../text/style';
import type { Measurer } from '../text/wrap';
import { wrapRuns } from '../text/wrap';

/**
 * The sticky kind: a coloured note whose text is centred and whose box grows to
 * fit what its author typed. The note colour and the growth live here rather
 * than in the paint walker, so the one place that decides a sticky's box is the
 * same one the writer calls.
 */

/** The colour a sticky is born wearing: the palette's note hue. */
export const NOTE_COLOUR = 'yellow' as const;

/**
 * The style a sticky is born wearing: the note colour, filled bold so the note
 * reads at once, with the foreground ink as its edge.
 */
export const NOTE_STYLE: Style = {
  corner: 'sharp',
  dash: 'solid',
  fill: NOTE_COLOUR,
  fillStyle: 'bold',
  stroke: 'ink',
  strokeWidth: 2,
};

/** The square a click places a sticky in, before any label is typed. */
export const DEFAULT_STICKY_SIZE = { h: 160, w: 160 } as const;

/**
 * The shortest an auto note may be refitted to: the square a click places. An
 * emptied note therefore stays a note rather than collapsing to its padding.
 */
export const MIN_STICKY_HEIGHT = DEFAULT_STICKY_SIZE.h;

/**
 * The room a sticky's wrapped label needs, padding included. Text is wrapped to
 * the note's authored width, so a note grows downward and never sideways.
 */
const contentHeight = (
  text: string,
  width: number,
  size: number,
  measure: Measurer
): number => {
  const room = width - TEXT_PADDING * 2;
  if (room <= 0) {
    return 0;
  }
  const lines = wrapRuns(parseRuns(text), room, size, measure);

  return lines.length === 0
    ? 0
    : lines.length * size * TEXT_LINE_HEIGHT + TEXT_PADDING * 2;
};

/**
 * The sticky refitted to its wrapped label in either direction — grown when the
 * words need more room and shrunk back when they need less — floored at the
 * square a click places. The authored width and top-left corner are kept, so a
 * refit reaches nothing but the note's own height: a neighbour is not moved and
 * a frame it sits in is not resized. A `fixed` note, or one with no measurer to
 * wrap its words, is left exactly as authored.
 */
export const fitSticky = (
  shape: StickyShape,
  measure?: Measurer
): StickyShape => {
  if (shape.fit === 'fixed' || measure === undefined) {
    return shape;
  }
  const { text } = shape;
  const style = shape.textStyle ?? DEFAULT_TEXT_STYLE;
  const needed =
    text === undefined || text === ''
      ? 0
      : contentHeight(text, shape.w, style.size, measure);
  const height = Math.max(needed, MIN_STICKY_HEIGHT);

  return height === shape.h ? shape : { ...shape, h: height };
};
