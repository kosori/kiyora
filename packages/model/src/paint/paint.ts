import type {
  Board,
  FigureKind,
  FigureShape,
  Shape,
  Style,
} from '../board/schema';
import { rectanglePath } from './figures';
import { FILL_ALPHA, paintColour, type Theme } from './palette';

/** One path a renderer draws, in board coordinates. */
export type PaintPath = {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
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

const paintRectangle = (shape: FigureShape, context: PaintContext): Paint => ({
  children: [],
  paths: [
    {
      d: rectanglePath(shape),
      fill: fillOf(shape.style, context.theme, shape.opacity),
      stroke: strokeOf(shape.style, context.theme, shape.opacity),
      strokeWidth: shape.style.strokeWidth,
    },
  ],
});

/** One painter per figure kind. Adding a kind to the schema breaks this table. */
const figurePainters = {
  rectangle: paintRectangle,
} satisfies Record<
  FigureKind,
  (shape: FigureShape, context: PaintContext) => Paint
>;

/** The paint for one shape: its own paths, then its children's, named by its id. */
export const paintShape = (shape: Shape, context: PaintContext): Paint => ({
  ...figurePainters[shape.kind](shape, context),
  shapeId: shape.id,
});

/** The paint for one board: one child per shape, in paint order. */
export const paintBoard = (board: Board, context: PaintContext): Paint => ({
  children: board.shapes.map((shape) => paintShape(shape, context)),
  paths: [],
});
