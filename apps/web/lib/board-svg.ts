import {
  type Board,
  exportBoardSvg,
  type PaintContext,
  SVG_FILE_EXTENSION,
} from '@kiyora/model';
import { boardFileName } from './board-file';

/**
 * Writes the board out as one self-contained SVG download: the drawing, with its
 * hand-drawn strokes, and nothing of the editor. A board that cannot leave the
 * app safely refuses instead, so the refusal reaches the caller rather than
 * becoming a truncated file.
 */
export const saveBoardSvg = (board: Board, context: PaintContext): void => {
  const url = URL.createObjectURL(
    new Blob([exportBoardSvg(board, context)], { type: 'image/svg+xml' })
  );
  const link = document.createElement('a');
  link.download = boardFileName(board.title, SVG_FILE_EXTENSION);
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};
