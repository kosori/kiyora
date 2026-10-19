import type {
  Board,
  ConnectorShape,
  Dash,
  FigureShape,
  FrameShape,
  Shape,
  StickyShape,
  Style,
} from '../board/schema';
import { type PaintText, textOf } from '../text/layout';
import type { Measurer } from '../text/wrap';
import { connectorInk, connectorLabel } from './connectors';
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

/** One box-shaped shape's path: the box its author drew, styled by the palette. */
const boxPath = (shape: Shape, context: PaintContext): PaintPath => {
  const dash = DASH_PATTERN[shape.style.dash];

  return {
    d: rectanglePath(shape),
    ...(dash === undefined ? {} : { dash }),
    fill: fillOf(shape.style, context.theme, shape.opacity),
    stroke: strokeOf(shape.style, context.theme, shape.opacity),
    strokeWidth: shape.style.strokeWidth,
  };
};

/** One box-shaped shape's paint: the box, then the hand-drawn overlay over it. */
const paintBox = (shape: Shape, context: PaintContext): PaintPath[] => {
  const clean = boxPath(shape, context);
  const overlay =
    clean.stroke === undefined
      ? null
      : overlayPath(shape, 0, clean.d, clean.stroke);

  return overlay === null ? [clean] : [clean, overlay];
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
 * Paints one sticky: its note box, in the note colour, behind its centred
 * label. The box is the authored one — a label is wrapped into it and grown
 * before it is stored, so the paint walker draws the note's own truth.
 */
const paintSticky = (shape: StickyShape, context: PaintContext): Paint => ({
  children: [],
  paths: paintBox(shape, context),
});

/**
 * Paints one frame: the box its author drew, and — when it clips — the same box
 * as the region its members are held inside. The clip is the authored box, so
 * dropping a member in never resizes the frame to fit it.
 */
const paintFrame = (shape: FrameShape, context: PaintContext): Paint => ({
  children: [],
  clip: shape.clip ? rectanglePath(shape) : undefined,
  paths: paintBox(shape, context),
});

/**
 * Paints one connector: the line and a head at each end that asks for one, in
 * the stroke's own colour and dash, plus its label. The path comes from the
 * board the connector is painted with, so a bound end follows its shape with no
 * repair pass and the artifact sees exactly what the canvas draws.
 */
const paintConnector = (
  shape: ConnectorShape,
  shapes: readonly Shape[],
  context: PaintContext
): Paint => {
  const stroke = strokeOf(shape.style, context.theme, shape.opacity);
  const dash = DASH_PATTERN[shape.style.dash];
  const paths = connectorInk(shape, shapes).map((part) => ({
    d: part.d,
    ...(part.head === true || dash === undefined ? {} : { dash }),
    fill: part.filled === true ? stroke : 'none',
    stroke,
    strokeWidth: shape.style.strokeWidth,
  }));
  const text = connectorLabel(
    shape,
    shapes,
    paintColour(FOREGROUND, context.theme, shape.opacity)
  );

  return {
    children: [],
    paths,
    ...(text.length === 0 ? {} : { text }),
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

/**
 * The paint for one shape: its own paths, then its children's, named by its id.
 * A connector cannot be painted from itself — its path is resolved from the
 * shapes its ends name — so it fails loudly here rather than drawing nothing;
 * `paintBoard` is the way to paint one.
 */
export const paintShape = (shape: Shape, context: PaintContext): Paint => {
  if (shape.kind === 'connector') {
    throw new Error('painting a connector needs the board: use paintBoard');
  }
  const figure =
    shape.kind === 'frame'
      ? paintFrame(shape, context)
      : shape.kind === 'sticky'
        ? paintSticky(shape, context)
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
 * can be clipped by it; a shape with no parent stays at the top level. A
 * connector is painted against the whole board, because its path is resolved
 * from the shapes its ends name.
 */
export const paintBoard = (board: Board, context: PaintContext): Paint => {
  const nodes = new Map<string, Paint>();
  const children: Paint[] = [];

  for (const shape of board.shapes) {
    const node =
      shape.kind === 'connector'
        ? paintConnector(shape, board.shapes, context)
        : paintShape(shape, context);
    node.shapeId = shape.id;
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
