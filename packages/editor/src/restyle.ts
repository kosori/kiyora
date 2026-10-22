import type { Board, FrameVariant, Style, TextStyle } from '@kiyora/model';
import { DEFAULT_TEXT_STYLE } from '@kiyora/model';
import { type Selection, selectedShapes } from './selection';
import { markSourceStale } from './source-state';

/**
 * One change the inspector makes: part of a shape's style, the opacity that
 * lives on the shape rather than in the palette, part of its label's text
 * style, or the variant a selected frame wears. Text and a variant are not the
 * palette, so neither becomes the style the next shape wears.
 */
export type Restyle = {
  opacity?: number;
  style?: Partial<Style>;
  textStyle?: Partial<TextStyle>;
  variant?: FrameVariant;
};

/** The board after a restyle, and the style the next shape will wear, if any. */
export type RestyleResult = {
  board: Board;
  style?: Style;
};

/**
 * Restyles every selected shape in one board write, so the whole change is a
 * single commit. A shape style change makes the first restyled shape's style the
 * last used one, so the next shape a person places matches what they just made;
 * a text-only change leaves that style alone. Returns `null` when nothing is
 * selected, so the caller can leave the board untouched.
 */
export const restyledBoard = (
  board: Board,
  selection: Selection,
  change: Restyle
): RestyleResult | null => {
  const shapes = selectedShapes(board, selection).filter(
    (shape) => !shape.locked
  );
  if (shapes.length === 0) {
    return null;
  }

  const touchesShape =
    change.style !== undefined || change.opacity !== undefined;
  const selected = new Set(shapes.map((one) => one.id));
  let nextStyle: Style | undefined;

  const shapesNext = board.shapes.map((shape) => {
    if (!selected.has(shape.id)) {
      return shape;
    }
    const base =
      change.variant !== undefined && shape.kind === 'frame'
        ? { ...shape, variant: change.variant }
        : shape;
    const restyled = {
      ...base,
      ...(change.opacity === undefined ? {} : { opacity: change.opacity }),
      ...(change.textStyle === undefined
        ? {}
        : {
            textStyle: {
              ...(shape.textStyle ?? DEFAULT_TEXT_STYLE),
              ...change.textStyle,
            },
          }),
      style:
        change.style === undefined
          ? shape.style
          : { ...shape.style, ...change.style },
    };
    if (touchesShape) {
      nextStyle ??= restyled.style;
    }
    return restyled;
  });

  const nextBoard = markSourceStale(
    board,
    { ...board, shapes: shapesNext },
    selected
  );

  return nextStyle === undefined
    ? { board: nextBoard }
    : { board: nextBoard, style: nextStyle };
};
