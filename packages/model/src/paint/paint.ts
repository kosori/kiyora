import type { BoardFiles } from '../board/image';
import type {
  Board,
  ConnectorShape,
  Dash,
  FigureShape,
  FrameShape,
  IconShape,
  Shape,
  StickyShape,
  Style,
} from '../board/schema';
import { formatNumber } from '../format';
import { ICON_VIEWBOX, type IconSet } from '../icons/icon-set';
import { type PaintText, textOf } from '../text/layout';
import type { Measurer } from '../text/wrap';
import { connectorInk, connectorLabel } from './connectors';
import { shapesInView } from './cull';
import { FIGURE_GEOMETRY } from './figure-geometry';
import { type Bounds, rectanglePath } from './figures';
import {
  FRAME_CHROME,
  type FrameChromePath,
  type FrameChromeRole,
} from './frame-geometry';
import { type PaintImage, paintImage } from './image';
import { FILL_ALPHA, FOREGROUND, paintColour, type Theme } from './palette';

/** One path a renderer draws, in board coordinates. */
export type PaintPath = {
  d: string;
  dash?: number[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /**
   * How the path's own coordinates map onto the board. An icon is authored in
   * its library's square and scaled into the box the author drew, so it carries
   * the transform; every figure has its coordinates in board space already.
   */
  transform?: string;
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
  /** The raster this shape draws, absent when it draws none. */
  image?: PaintImage;
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
 * What a board cannot carry: the canvas it is painted on, the measurer text
 * needs, and — when a live view is painting — the board box that view shows.
 * Measurement needs a DOM, and `model` must not have one, so the caller injects
 * it; a shape with text and no measurer fails loudly rather than painting
 * nothing. `view` is display-only: an artifact passes none and therefore paints
 * the whole board.
 */
export type PaintContext = {
  theme: Theme;
  /**
   * The rasters a board's image shapes name. The payload is authored state and
   * travels with the board, so the walker is handed it rather than reading a
   * store; a context without it paints each image's authored box instead.
   */
  files?: BoardFiles;
  /**
   * The icon paths a board's icon shapes name. The dataset is generated and
   * loaded on demand, so the walker is handed it rather than importing it; a
   * context without it still paints, degrading each icon to its authored box.
   */
  icons?: IconSet;
  measure?: Measurer;
  view?: Bounds;
};

const fillOf = (style: Style, theme: Theme, opacity: number): string => {
  const alpha = FILL_ALPHA[style.fillStyle] * opacity;
  return alpha === 0 ? 'none' : paintColour(style.fill, theme, alpha);
};

const strokeOf = (style: Style, theme: Theme, opacity: number): string =>
  paintColour(style.stroke, theme, opacity);

/** One path drawn on a shape's box, styled by the palette. */
const styledPath = (
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
const boxPath = (shape: Shape, context: PaintContext): PaintPath =>
  styledPath(rectanglePath(shape), shape, context);

/** One box-shaped shape's paint: its clean box, styled by the palette. */
const paintBox = (shape: Shape, context: PaintContext): PaintPath[] => [
  boxPath(shape, context),
];

/** Paints one figure: every path its geometry names, styled by the palette. */
const paintFigure = (shape: FigureShape, context: PaintContext): Paint => {
  const dash = DASH_PATTERN[shape.style.dash];
  const fill = fillOf(shape.style, context.theme, shape.opacity);
  const stroke = strokeOf(shape.style, context.theme, shape.opacity);
  const paths = FIGURE_GEOMETRY[shape.kind](shape).map(
    (ink): PaintPath => ({
      d: ink.d,
      ...(dash === undefined ? {} : { dash }),
      fill: ink.filled === false ? 'none' : fill,
      stroke,
      strokeWidth: shape.style.strokeWidth,
    })
  );

  return { children: [], paths };
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
 * How the foreground inks each piece of device chrome: a bar is a tinted band,
 * a detail is a stroke, and a dot is a small solid. The body is absent because
 * it wears the frame's own fill and stroke, which keeps the shape a person
 * styled. Alpha scales with the shape's opacity, like every other paint.
 */
const CHROME_INK: Record<
  Exclude<FrameChromeRole, 'body'>,
  { fill?: number; stroke?: number; strokeWidth: number }
> = {
  bar: { fill: 0.08, stroke: 0.2, strokeWidth: 1 },
  dot: { fill: 0.45, strokeWidth: 0 },
  line: { stroke: 0.35, strokeWidth: 2 },
};

/** One piece of chrome, in the role's ink rather than the frame's fill. */
const chromePath = (
  chrome: FrameChromePath,
  shape: FrameShape,
  context: PaintContext
): PaintPath => {
  if (chrome.role === 'body') {
    return styledPath(chrome.d, shape, context);
  }
  const ink = CHROME_INK[chrome.role];

  return {
    d: chrome.d,
    ...(ink.fill === undefined
      ? {}
      : {
          fill: paintColour(
            FOREGROUND,
            context.theme,
            ink.fill * shape.opacity
          ),
        }),
    ...(ink.stroke === undefined
      ? {}
      : {
          stroke: paintColour(
            FOREGROUND,
            context.theme,
            ink.stroke * shape.opacity
          ),
        }),
    ...(ink.strokeWidth === 0 ? {} : { strokeWidth: ink.strokeWidth }),
  };
};

/**
 * Paints one frame: the box its author drew, or — for a device variant — that
 * box with the variant's chrome inside it, and, when it clips, the authored box
 * as the region its members are held inside. The chrome is painted before the
 * members, and never shrinks the clip, so a member keeps every inch its author
 * gave it and is drawn over the chrome rather than under it or outside it.
 */
const paintFrame = (shape: FrameShape, context: PaintContext): Paint => {
  const chrome =
    shape.w > 0 && shape.h > 0 ? FRAME_CHROME[shape.variant](shape) : [];

  return {
    children: [],
    clip: shape.clip ? rectanglePath(shape) : undefined,
    paths:
      chrome.length === 0
        ? paintBox(shape, context)
        : chrome.map((piece) => chromePath(piece, shape, context)),
  };
};

/**
 * Paints one group: nothing. Its ink belongs to its members, and they paint
 * through the nesting the walker builds; a group that drew its own box would
 * put a line on the canvas nobody authored.
 */
const paintGroup = (): Paint => ({ children: [], paths: [] });

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
  const paths: PaintPath[] = connectorInk(shape, shapes).map((part) => ({
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
 * Paints one icon: the dataset's path for its name, fitted into the authored
 * box and turned with it. The fit is uniform, so an icon keeps its shape in a
 * wide or tall box; the stroke and dash are divided by the same scale, so they
 * still read in board units rather than growing with the icon. A name the
 * dataset does not know paints the authored box instead, so an old or newer
 * file opens as a legible placeholder rather than an empty hole.
 */
const paintIcon = (shape: IconShape, context: PaintContext): Paint => {
  const paths = context.icons?.[shape.name];
  const scale = Math.min(shape.w, shape.h) / ICON_VIEWBOX;

  if (paths === undefined || scale <= 0) {
    return { children: [], paths: paintBox(shape, context) };
  }

  const x = shape.x + (shape.w - ICON_VIEWBOX * scale) / 2;
  const y = shape.y + (shape.h - ICON_VIEWBOX * scale) / 2;
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  const dash = DASH_PATTERN[shape.style.dash]?.map((value) => value / scale);
  const transform = `rotate(${formatNumber(shape.rotation)} ${formatNumber(cx)} ${formatNumber(cy)}) translate(${formatNumber(x)} ${formatNumber(y)}) scale(${formatNumber(scale)})`;

  return {
    children: [],
    paths: [
      {
        d: paths,
        ...(dash === undefined ? {} : { dash }),
        fill: 'none',
        stroke: strokeOf(shape.style, context.theme, shape.opacity),
        strokeWidth: shape.style.strokeWidth / scale,
        transform,
      },
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
        : shape.kind === 'group'
          ? paintGroup()
          : shape.kind === 'text'
            ? { children: [], paths: [] }
            : shape.kind === 'icon'
              ? paintIcon(shape, context)
              : shape.kind === 'image'
                ? paintImage(
                    shape,
                    context.files?.[shape.fileId],
                    boxPath(shape, context)
                  )
                : paintFigure(shape, context);
  const text = labelOf(shape, context);

  return {
    ...figure,
    ...(text.length === 0 ? {} : { text }),
    shapeId: shape.id,
  };
};

/**
 * The paint for one board: one child per shape, in paint order, nested inside
 * the frame or group its `parentId` names. A connector paints against the whole
 * board, because its path is resolved from the shapes its ends name. When the
 * context carries a `view`, only the shapes that view can show are painted; the
 * export passes none, so nothing display-only reaches an artifact.
 */
export const paintBoard = (board: Board, context: PaintContext): Paint => {
  const nodes = new Map<string, Paint>();
  const children: Paint[] = [];
  const shapes =
    context.view === undefined
      ? board.shapes
      : shapesInView(board, context.view);

  for (const shape of shapes) {
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
