import type { Shape } from '../board/schema';
import type { Dash, Style } from '../board/shape-base';
import { FILL_ALPHA, paintColour, type Theme } from '../paint/palette';
import { rectanglePath } from './figures';
import type { PaintContext, PaintPath } from './paint';

/** The numbers a stroke pattern breaks an outline into; a solid stroke has none. */
export const DASH_PATTERN: Record<Dash, number[] | undefined> = {
  dashed: [8, 6],
  dotted: [2, 6],
  solid: undefined,
};

/** The interior colour of a styled shape, already faded by its opacity. */
export const fillOf = (style: Style, theme: Theme, opacity: number): string => {
  const alpha = FILL_ALPHA[style.fillStyle] * opacity;
  return alpha === 0 ? 'none' : paintColour(style.fill, theme, alpha);
};

/** The outline colour of a styled shape, already faded by its opacity. */
export const strokeOf = (style: Style, theme: Theme, opacity: number): string =>
  paintColour(style.stroke, theme, opacity);

/** One path drawn on a shape's box, styled by the palette. */
export const styledPath = (
  d: string,
  shape: Shape,
  context: PaintContext
): PaintPath => {
  const dash = DASH_PATTERN[shape.style.dash];

  return {
    d,
    ...(dash === undefined ? {} : { dash }),
    fill: fillOf(shape.style, context.theme, shape.opacity),
    stroke: strokeOf(shape.style, context.theme, shape.opacity),
    strokeWidth: shape.style.strokeWidth,
  };
};

/** One box-shaped shape's path: the box its author drew, styled by the palette. */
export const boxPath = (shape: Shape, context: PaintContext): PaintPath =>
  styledPath(rectanglePath(shape), shape, context);

/** One box-shaped shape's paint: its clean box, styled by the palette. */
export const paintBox = (shape: Shape, context: PaintContext): PaintPath[] => [
  boxPath(shape, context),
];
