import type { Board, FigureShape, Shape, Style } from '../board/schema';
import { type PaintText, textOf } from '../text/layout';
import type { Measurer } from '../text/wrap';
import { FIGURE_GEOMETRY } from './figure-geometry';
import { FILL_ALPHA, FOREGROUND, paintColour, type Theme } from './palette';

/** One path a renderer draws, in board coordinates. */
export type PaintPath = {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

/** The render-ready description of a shape: its own paths, its label, then its children's. */
export type Paint = {
  paths: PaintPath[];
  /** The lines of a label, absent when the shape carries no text. */
  text?: PaintText[];
  children: Paint[];
  /**
   * The shape this node came from. A renderer keys its elements by this rather
   * than by array position, so a repaint follows identity. The board's own node
   * carries none, because the board is not a shape.
   */
  shapeId?: string;
};

/**
 * What a board cannot carry: the canvas it is painted on, and the measurer text
 * needs. Measurement needs a DOM, and `model` must not have one, so the caller
 * injects it; a shape with text and no measurer fails loudly rather than
 * painting nothing.
 */
export type PaintContext = {
  theme: Theme;
  measure?: Measurer;
};

const fillOf = (style: Style, theme: Theme, opacity: number): string => {
  const alpha = FILL_ALPHA[style.fillStyle] * opacity;
  return alpha === 0 ? 'none' : paintColour(style.fill, theme, alpha);
};

const strokeOf = (style: Style, theme: Theme, opacity: number): string =>
  paintColour(style.stroke, theme, opacity);

/** Paints one figure: every path its geometry names, styled by the palette. */
const paintFigure = (shape: FigureShape, context: PaintContext): Paint => ({
  children: [],
  paths: FIGURE_GEOMETRY[shape.kind](shape).map((ink) => ({
    d: ink.d,
    fill:
      ink.filled === false
        ? 'none'
        : fillOf(shape.style, context.theme, shape.opacity),
    stroke: strokeOf(shape.style, context.theme, shape.opacity),
    strokeWidth: shape.style.strokeWidth,
  })),
});

/**
 * The label a shape carries, in the foreground ink so its glyphs are never the
 * `none` that once made a Text tool invisible.
 */
const labelOf = (shape: Shape, context: PaintContext): PaintText[] => {
  if (shape.text === undefined || shape.text === '') {
    return [];
  }
  if (context.measure === undefined) {
    throw new Error('painting text needs a measurer on the context');
  }
  return textOf(
    shape,
    context.measure,
    paintColour(FOREGROUND, context.theme, shape.opacity)
  );
};

/** The paint for one shape: its own paths, then its children's, named by its id. */
export const paintShape = (shape: Shape, context: PaintContext): Paint => {
  const figure =
    shape.kind === 'text'
      ? { children: [], paths: [] }
      : paintFigure(shape, context);
  const text = labelOf(shape, context);

  return {
    ...figure,
    ...(text.length === 0 ? {} : { text }),
    shapeId: shape.id,
  };
};

/** The paint for one board: one child per shape, in paint order. */
export const paintBoard = (board: Board, context: PaintContext): Paint => ({
  children: board.shapes.map((shape) => paintShape(shape, context)),
  paths: [],
});
