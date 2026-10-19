import type {
  Board,
  Dash,
  FigureShape,
  FrameShape,
  Shape,
  Style,
} from '../board/schema';
import { FIGURE_GEOMETRY } from './figure-geometry';
import { rectanglePath } from './figures';
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
   * The path this node's children are clipped to, in board coordinates. A
   * clipping frame carries it, so its members stay inside the box its author
   * drew; a node without it paints its children unclipped.
   */
  clip?: string;
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

/**
 * Paints one frame: the box its author drew, and — when it clips — the same box
 * as the region its members are held inside. The clip is the authored box, so
 * dropping a member in never resizes the frame to fit it.
 */
const paintFrame = (shape: FrameShape, context: PaintContext): Paint => ({
  children: [],
  clip: shape.clip ? rectanglePath(shape) : undefined,
  paths: [
    {
      d: rectanglePath(shape),
      fill: fillOf(shape.style, context.theme, shape.opacity),
      stroke: strokeOf(shape.style, context.theme, shape.opacity),
      strokeWidth: shape.style.strokeWidth,
    },
  ],
});

/** The paint for one shape: its own paths, then its children's, named by its id. */
export const paintShape = (shape: Shape, context: PaintContext): Paint => {
  const paint =
    shape.kind === 'frame'
      ? paintFrame(shape, context)
      : paintFigure(shape, context);

  return { ...paint, shapeId: shape.id };
};

/**
 * The paint for one board: one child per shape, in paint order. A shape whose
 * `parentId` names a frame is nested inside it, where it follows its frame and
 * can be clipped by it; a shape with no parent stays at the top level.
 */
export const paintBoard = (board: Board, context: PaintContext): Paint => {
  const nodes = new Map<string, Paint>();
  const children: Paint[] = [];

  for (const shape of board.shapes) {
    const node = paintShape(shape, context);
    nodes.set(shape.id, node);

    const parent =
      shape.parentId === null ? undefined : nodes.get(shape.parentId);
    if (parent === undefined) {
      children.push(node);
    } else {
      parent.children.push(node);
    }
  }

  return { children, paths: [] };
};
