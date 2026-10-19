import type { Board, Style } from '@kiyora/model';
import { type Selection, selectedShapes } from './selection';

/**
 * One style change the inspector makes: part of a shape's style, and the
 * opacity that lives on the shape rather than in the palette.
 */
export type Restyle = {
  opacity?: number;
  style?: Partial<Style>;
};

/** The board after a restyle, and the style the next shape will wear. */
export type RestyleResult = {
  board: Board;
  style: Style;
};

/**
 * Restyles every selected shape in one board write, so the whole change is a
 * single commit. The style the first restyled shape wears becomes the last used
 * one, so the next shape a person places matches what they just made. Returns
 * `null` when nothing is selected, so the caller can leave the board untouched.
 */
export const restyledBoard = (
  board: Board,
  selection: Selection,
  change: Restyle
): RestyleResult | null => {
  const shapes = selectedShapes(board, selection);
  if (shapes.length === 0) {
    return null;
  }

  const selected = new Set(shapes.map((one) => one.id));
  let nextStyle: Style | undefined;

  const shapesNext = board.shapes.map((shape) => {
    if (!selected.has(shape.id)) {
      return shape;
    }
    const restyled = {
      ...shape,
      ...(change.opacity === undefined ? {} : { opacity: change.opacity }),
      style:
        change.style === undefined
          ? shape.style
          : { ...shape.style, ...change.style },
    };
    nextStyle ??= restyled.style;
    return restyled;
  });

  if (nextStyle === undefined) {
    return null;
  }

  return { board: { ...board, shapes: shapesNext }, style: nextStyle };
};
