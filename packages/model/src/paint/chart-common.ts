import type { ChartShape } from '../board/chart';
import { truncateToWidth } from '../chart/scale';
import { formatNumber } from '../format';
import type { PaintText } from '../text/layout';
import type { PaintContext, PaintPath } from './paint';
import { FOREGROUND, type PaletteColour, paintColour } from './palette';

/** The size a chart's axis and category labels are painted at, in board units. */
export const CHART_LABEL_SIZE = 10;

/** The breathing room between a chart's authored box and its marks. */
export const CHART_PADDING = 10;

/** How much of a label's ink reaches the canvas, before the shape's own opacity. */
const LABEL_ALPHA = 0.62;

/** A rectangle in board coordinates. */
export type ChartBox = {
  h: number;
  w: number;
  x: number;
  y: number;
};

/**
 * The box a chart draws inside: its authored box less the padding. A box too
 * small to hold any padding keeps a zero-size plot, which its painter reads as
 * nothing to draw rather than a negative rectangle.
 */
export const chartBox = (shape: ChartShape): ChartBox | null => {
  const pad = Math.min(CHART_PADDING, shape.w / 4, shape.h / 4);
  const w = shape.w - pad * 2;
  const h = shape.h - pad * 2;

  return w <= 0 || h <= 0 ? null : { h, w, x: shape.x + pad, y: shape.y + pad };
};

/** The rotation a chart's marks and labels are turned by, or nothing when it is upright. */
export const chartTransform = (shape: ChartShape): string | undefined =>
  shape.rotation === 0
    ? undefined
    : `rotate(${formatNumber(shape.rotation)} ${formatNumber(shape.x + shape.w / 2)} ${formatNumber(shape.y + shape.h / 2)})`;

/** One label placed in board coordinates, measured and truncated to the room it has. */
export const chartLabel = (
  shape: ChartShape,
  context: PaintContext,
  text: string,
  x: number,
  y: number,
  align: PaintText['align'],
  maxWidth?: number
): PaintText | null => {
  const trimmed = text.trim();

  if (trimmed === '' || context.measure === undefined) {
    return null;
  }

  const fitted =
    maxWidth === undefined
      ? trimmed
      : truncateToWidth(trimmed, maxWidth, context.measure, CHART_LABEL_SIZE);

  if (fitted === '') {
    return null;
  }

  const transform = chartTransform(shape);

  return {
    align,
    fill: paintColour(FOREGROUND, context.theme, LABEL_ALPHA * shape.opacity),
    runs: [
      { bold: false, code: false, href: null, italic: false, text: fitted },
    ],
    size: CHART_LABEL_SIZE,
    ...(transform === undefined ? {} : { transform }),
    x,
    y,
  };
};

/** A mark filled in one palette colour at the chart's own opacity. */
export const filledPath = (
  shape: ChartShape,
  context: PaintContext,
  d: string,
  colour: PaletteColour,
  alpha: number
): PaintPath => {
  const transform = chartTransform(shape);
  const faded = alpha * shape.opacity;

  return {
    d,
    fill: faded <= 0 ? 'none' : paintColour(colour, context.theme, faded),
    ...(transform === undefined ? {} : { transform }),
  };
};

/** A mark outlined in one palette colour, in board units rather than a fraction of the box. */
export const strokedPath = (
  shape: ChartShape,
  context: PaintContext,
  d: string,
  colour: PaletteColour,
  width: number
): PaintPath => {
  const transform = chartTransform(shape);

  return {
    d,
    fill: 'none',
    stroke: paintColour(colour, context.theme, shape.opacity),
    strokeWidth: width,
    ...(transform === undefined ? {} : { transform }),
  };
};

/** A line in the foreground ink, for an axis or a gridline rather than a series mark. */
export const rulePath = (
  shape: ChartShape,
  context: PaintContext,
  d: string,
  alpha: number,
  width = 1
): PaintPath => {
  const transform = chartTransform(shape);

  return {
    d,
    fill: 'none',
    stroke: paintColour(FOREGROUND, context.theme, alpha * shape.opacity),
    strokeWidth: width,
    ...(transform === undefined ? {} : { transform }),
  };
};

/** The line width a chart's series marks wear, from the shape's own stroke. */
export const chartStroke = (shape: ChartShape): number =>
  Math.max(1, shape.style.strokeWidth);

/** The path a rectangle traces, in board coordinates. */
export const rectPath = (box: ChartBox): string =>
  `M ${formatNumber(box.x)} ${formatNumber(box.y)} L ${formatNumber(box.x + box.w)} ${formatNumber(box.y)} L ${formatNumber(box.x + box.w)} ${formatNumber(box.y + box.h)} L ${formatNumber(box.x)} ${formatNumber(box.y + box.h)} Z`;

/** The path a dot traces: one point a line or a scatter paints instead of an empty stroke. */
export const dotPath = (x: number, y: number, radius: number): string => {
  const left = formatNumber(x - radius);
  const top = formatNumber(y);
  const diameter = formatNumber(radius * 2);
  const back = formatNumber(-radius * 2);

  return `M ${left} ${top} a ${formatNumber(radius)} ${formatNumber(radius)} 0 1 0 ${diameter} 0 a ${formatNumber(radius)} ${formatNumber(radius)} 0 1 0 ${back} 0 Z`;
};

/** The radius a one-point line, area, scatter or sparkline paints, so the point stays visible. */
export const dotRadius = (plot: ChartBox): number =>
  Math.max(2, Math.min(4, Math.min(plot.w, plot.h) / 20));

/** The text palette colour for a legend's own swatch. */
export const swatchAlpha = 0.9;
