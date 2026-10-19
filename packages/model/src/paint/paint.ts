import type {
  Board,
  Dash,
  FigureShape,
  FrameShape,
  Shape,
  Style,
} from '../board/schema';
import { type PaintText, textOf } from '../text/layout';
import type { Measurer } from '../text/wrap';
import { FIGURE_GEOMETRY } from './figure-geometry';
import { rectanglePath } from './figures';
import { FILL_ALPHA, FOREGROUND, paintColour, type Theme } from './palette';
import { deriveWobbleSeed, WOBBLE_OPACITY, wobblePath } from './wobble';

/** One path a renderer draws, in board coordinates. */
export type PaintPath = {
  d: string;
  dash?: number[];
  fill?: string;
  /** The alpha a hand-drawn overlay's ribbon paints at, so the clean stroke reads through. */
  fillOpacity?: number;
  /** True when this path is the hand-drawn overlay traced over a shape's clean geometry. */
  overlay?: true;
  stroke?: string;
  strokeWidth?: number;
};

/** The numbers a stroke pattern breaks an outline into; a solid stroke has none. */
export const DASH_PATTERN: Record<Dash, number[] | undefined> = {
  dashed: [8, 6],
  dotted: [2, 6],
  solid: undefined,
};

/** The render-ready description of a shape: its own paths, its label, then its children's. */
export type Paint = {
  paths: PaintPath[];
  /** The lines of a label, absent when the shape carries no text. */
  text?: PaintText[];
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

/**
 * The hand-drawn overlay over one clean path, or `null` when the path is too
 * degenerate to trace. The ribbon is drawn in the shape's own stroke colour and
 * is wide enough to cover the clean line beneath it. It is seeded by the shape's
 * id and the path's place in its geometry, so two identically shaped figures do
 * not look stamped, and the seed never moves with the shape.
 */
const overlayPath = (
  shape: Shape,
  index: number,
  d: string,
  stroke: string
): PaintPath | null => {
  const traced = wobblePath(
    d,
    deriveWobbleSeed(`${shape.id}:${index}`),
    shape.style.strokeWidth
  );

  return traced === null
    ? null
    : {
        d: traced,
        fill: stroke,
        fillOpacity: WOBBLE_OPACITY,
        overlay: true,
      };
};

/** Paints one figure: every path its geometry names, styled by the palette. */
const paintFigure = (shape: FigureShape, context: PaintContext): Paint => {
  const dash = DASH_PATTERN[shape.style.dash];
  const fill = fillOf(shape.style, context.theme, shape.opacity);
  const stroke = strokeOf(shape.style, context.theme, shape.opacity);
  const clean: PaintPath[] = [];
  const overlay: PaintPath[] = [];

  FIGURE_GEOMETRY[shape.kind](shape).forEach((ink, index) => {
    clean.push({
      d: ink.d,
      ...(dash === undefined ? {} : { dash }),
      fill: ink.filled === false ? 'none' : fill,
      stroke,
      strokeWidth: shape.style.strokeWidth,
    });

    const traced = overlayPath(shape, index, ink.d, stroke);
    if (traced !== null) {
      overlay.push(traced);
    }
  });

  return { children: [], paths: [...clean, ...overlay] };
};

/**
 * Paints one frame: the box its author drew, and — when it clips — the same box
 * as the region its members are held inside. The clip is the authored box, so
 * dropping a member in never resizes the frame to fit it.
 */
const paintFrame = (shape: FrameShape, context: PaintContext): Paint => {
  const box = rectanglePath(shape);
  const stroke = strokeOf(shape.style, context.theme, shape.opacity);
  const overlay = overlayPath(shape, 0, box, stroke);

  return {
    children: [],
    clip: shape.clip ? box : undefined,
    paths: [
      {
        d: box,
        fill: fillOf(shape.style, context.theme, shape.opacity),
        stroke,
        strokeWidth: shape.style.strokeWidth,
      },
      ...(overlay === null ? [] : [overlay]),
    ],
  };
};

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
    shape.kind === 'frame'
      ? paintFrame(shape, context)
      : shape.kind === 'text'
        ? { children: [], paths: [] }
        : paintFigure(shape, context);
  const text = labelOf(shape, context);

  return {
    ...figure,
    ...(text.length === 0 ? {} : { text }),
    shapeId: shape.id,
  };
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
