import type { Board } from '../board/schema';
import { utf8Length } from '../format';
import type { IconSet } from '../icons/icon-set';
import type { Theme } from '../paint/palette';
import { projectBoard } from '../projection/svg';
import type { Measurer } from '../text/wrap';

/** The width every library preview renders at. Small enough to list many. */
export const PREVIEW_WIDTH = 240;

/**
 * The most bytes one preview may reach. A board that projects past it stores no
 * preview rather than a truncated one, because a tile that lies about its board
 * is worse than a tile that is neutral.
 */
export const PREVIEW_LIMIT_BYTES = 64 * 1024;

/** What a preview needs beyond the board: the canvas, text and icons it paints with. */
export type PreviewOptions = {
  theme: Theme;
  measure?: Measurer;
  icons?: IconSet;
  /** The byte cap for this preview. Defaults to `PREVIEW_LIMIT_BYTES`. */
  limitBytes?: number;
};

/**
 * One board as a small SVG document, through the same paint walker and
 * projection an export uses. It is clipped to the board's content bounds and
 * renders at a fixed width, so the tile shows the board's own paint rather than
 * a screenshot. `null` means the board would pass the cap: a preview is omitted,
 * never truncated.
 */
export const previewBoard = (
  board: Board,
  { theme, measure, icons, limitBytes = PREVIEW_LIMIT_BYTES }: PreviewOptions
): string | null => {
  const svg = projectBoard(
    board,
    { files: board.files, icons, measure, theme },
    { width: PREVIEW_WIDTH }
  );

  return utf8Length(svg) > limitBytes ? null : svg;
};
