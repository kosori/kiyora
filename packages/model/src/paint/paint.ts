import type { Board, Dash, FigureShape, Shape, Style } from '../board/schema';
import { FIGURE_GEOMETRY } from './figure-geometry';
import { FILL_ALPHA, paintColour, type Theme } from './palette';

/** One path a renderer draws, in board coordinates. */
export type PaintPath = {
  d: string;
  dash?: number[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

/** The numbers a stroke pattern breaks an outline into; a solid stroke has none. */
export const DASH_PATTERN: Record<Dash, number[] | undefined> = {
  dashed: [8, 6],
  dotted: [2, 6],
  solid: undefined,
};

/** The render-ready description of a shape: its own paths, then its children's. */
export type Paint = {
  paths: PaintPath[];
  children: Paint[];
  /**
   * The shape this node came from. A renderer keys its elements by this rather
   * than by array position, so a repaint follows identity. The board's own node
   * carries none, because the board is not a shape.
   */
  shapeId?: string;
};

/** What a board cannot carry: the canvas it is painted on. */
export type PaintContext = {
  theme: Theme;
};

const fillOf = (style: Style, theme: Theme, opacity: number): string => {
  const alpha = FILL_ALPHA[style.fillStyle] * opacity;
  return alpha === 0 ? 'none' : paintColour(style.fill, theme, alpha);
};

const strokeOf = (style: Style, theme: Theme, opacity: number): string =>
  paintColour(style.stroke, theme, opacity);

/** Paints one figure: every path its geometry names, styled by the palette. */
const paintFigure = (shape: FigureShape, context: PaintContext): Paint => {
  const dash = DASH_PATTERN[shape.style.dash];

  return {
    children: [],
    paths: FIGURE_GEOMETRY[shape.kind](shape).map((ink) => ({
      d: ink.d,
      ...(dash === undefined ? {} : { dash }),
      fill:
        ink.filled === false
          ? 'none'
          : fillOf(shape.style, context.theme, shape.opacity),
      stroke: strokeOf(shape.style, context.theme, shape.opacity),
      strokeWidth: shape.style.strokeWidth,
    })),
  };
};

/** The paint for one shape: its own paths, then its children's, named by its id. */
export const paintShape = (shape: Shape, context: PaintContext): Paint => ({
  ...paintFigure(shape, context),
  shapeId: shape.id,
});

/** The paint for one board: one child per shape, in paint order. */
export const paintBoard = (board: Board, context: PaintContext): Paint => ({
  children: board.shapes.map((shape) => paintShape(shape, context)),
  paths: [],
});
