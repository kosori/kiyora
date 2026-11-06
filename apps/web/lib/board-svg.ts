import {
  type Board,
  exportBoardSvg,
  type PaintContext,
  SVG_FILE_EXTENSION,
} from '@kiyora/model';
import { boardFileName } from './board-file';
import { downloadBlob } from './download';
import { iconSetFor } from './icon-set';

/**
 * Writes the board out as one self-contained SVG download: the drawing, with its
 * hand-drawn strokes, and nothing of the editor. A board that cannot leave the
 * app safely refuses instead, so the refusal reaches the caller rather than
 * becoming a truncated file.
 *
 * The icon dataset is fetched before the projection when the board names one, so
 * the artifact carries every icon path and no reference to the library. A board
 * with no icon never waits for the fetch.
 */
export const saveBoardSvg = async (
  board: Board,
  context: PaintContext
): Promise<void> => {
  const icons = await iconSetFor(board);
  const svg = exportBoardSvg(board, { ...context, files: board.files, icons });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  downloadBlob(url, boardFileName(board.title, SVG_FILE_EXTENSION));
};
