import type { ChartShape } from '../board/chart';
import { chartSlices, widestOf } from '../chart/scale';
import { formatNumber } from '../format';
import type { PaintText } from '../text/layout';
import {
  CHART_LABEL_SIZE,
  type ChartBox,
  chartLabel,
  filledPath,
  rectPath,
} from './chart-common';
import type { Paint, PaintContext, PaintPath } from './paint';

/** A full turn, in radians: the sweep one slice must reach to be a complete ring. */
const FULL_TURN = Math.PI * 2;

/** The share of a donut's radius its hole takes, leaving a band worth reading. */
const DONUT_HOLE = 0.55;

/** The dot a legend draws beside its label, and the gap before its words. */
const SWATCH = 8;
const SWATCH_GAP = 4;

/** One point on a circle, in board coordinates. */
const pointAt = (
  centre: { x: number; y: number },
  radius: number,
  angle: number
): { x: number; y: number } => ({
  x: centre.x + Math.cos(angle) * radius,
  y: centre.y + Math.sin(angle) * radius,
});

/** A complete circle, as one closed path. */
const circlePath = (centre: { x: number; y: number }, radius: number): string =>
  `M ${formatNumber(centre.x - radius)} ${formatNumber(centre.y)} a ${formatNumber(radius)} ${formatNumber(radius)} 0 1 0 ${formatNumber(radius * 2)} 0 a ${formatNumber(radius)} ${formatNumber(radius)} 0 1 0 ${formatNumber(-radius * 2)} 0 Z`;

/** A complete ring: an outer circle and a hole wound the other way, so the fill leaves the hole empty. */
const ringPath = (
  centre: { x: number; y: number },
  outer: number,
  inner: number
): string =>
  `M ${formatNumber(centre.x - outer)} ${formatNumber(centre.y)} a ${formatNumber(outer)} ${formatNumber(outer)} 0 1 0 ${formatNumber(outer * 2)} 0 a ${formatNumber(outer)} ${formatNumber(outer)} 0 1 0 ${formatNumber(-outer * 2)} 0 Z M ${formatNumber(centre.x - inner)} ${formatNumber(centre.y)} a ${formatNumber(inner)} ${formatNumber(inner)} 0 1 1 ${formatNumber(inner * 2)} 0 a ${formatNumber(inner)} ${formatNumber(inner)} 0 1 1 ${formatNumber(-inner * 2)} 0 Z`;

/** One wedge from the centre to the rim, or one band of a donut. */
const slicePath = (
  centre: { x: number; y: number },
  radius: number,
  inner: number,
  start: number,
  end: number
): string => {
  const large = end - start > Math.PI ? 1 : 0;
  const outerStart = pointAt(centre, radius, start);
  const outerEnd = pointAt(centre, radius, end);

  if (inner <= 0) {
    return `M ${formatNumber(centre.x)} ${formatNumber(centre.y)} L ${formatNumber(outerStart.x)} ${formatNumber(outerStart.y)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 ${large} 1 ${formatNumber(outerEnd.x)} ${formatNumber(outerEnd.y)} Z`;
  }

  const innerEnd = pointAt(centre, inner, end);
  const innerStart = pointAt(centre, inner, start);

  return `M ${formatNumber(outerStart.x)} ${formatNumber(outerStart.y)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 ${large} 1 ${formatNumber(outerEnd.x)} ${formatNumber(outerEnd.y)} L ${formatNumber(innerEnd.x)} ${formatNumber(innerEnd.y)} A ${formatNumber(inner)} ${formatNumber(inner)} 0 ${large} 0 ${formatNumber(innerStart.x)} ${formatNumber(innerStart.y)} Z`;
};

/** The legend beside a pie or a donut: one swatch and one truncated label per category. */
const legend = (
  shape: ChartShape,
  context: PaintContext,
  box: ChartBox,
  left: number,
  width: number
): { paths: PaintPath[]; text: PaintText[] } => {
  const paths: PaintPath[] = [];
  const text: PaintText[] = [];
  const row = CHART_LABEL_SIZE * 1.6;
  const start = left + 8;

  shape.series.forEach((_, index) => {
    const label = shape.labels[index] ?? '';
    const top = box.y + index * row;

    if (label.trim() === '' || top + row > box.y + box.h) {
      return;
    }

    paths.push(
      filledPath(
        shape,
        context,
        rectPath({
          h: SWATCH,
          w: SWATCH,
          x: start,
          y: top + row / 2 - SWATCH / 2,
        }),
        shape.palette[index % shape.palette.length] ?? 'blue',
        0.9
      )
    );
    const placed = chartLabel(
      shape,
      context,
      label,
      start + SWATCH + 4,
      top + row / 2 + CHART_LABEL_SIZE * 0.35,
      'left',
      width - SWATCH - 12
    );
    if (placed !== null) {
      text.push(placed);
    }
  });

  return { paths, text };
};

/**
 * A pie or a donut: one wedge per category, with a legend beside it when the
 * box has room for the labels. Both kinds share the slice math, so a change of
 * kind repaints the same series without touching its data; a donut is the same
 * wedges with a hole and a narrower radius, so the band stays as thick as the
 * circle allows.
 */
export const radialInk = (
  shape: ChartShape,
  context: PaintContext,
  box: ChartBox
): Paint => {
  const slices = chartSlices(shape.series);
  const labels = shape.series.map((_, index) => shape.labels[index] ?? '');
  const hasLabels =
    context.measure !== undefined &&
    labels.some((label) => label.trim() !== '');
  const legendWidth = hasLabels
    ? Math.min(
        widestOf(labels, context.measure, CHART_LABEL_SIZE) +
          SWATCH +
          SWATCH_GAP +
          8,
        box.w * 0.45
      )
    : 0;
  const disc: ChartBox = {
    h: box.h,
    w: box.w - legendWidth,
    x: box.x,
    y: box.y,
  };
  const radius = Math.min(disc.w, disc.h) / 2;

  if (radius <= 0) {
    return { children: [], paths: [], text: [] };
  }

  const centre = {
    x: disc.x + disc.w / 2,
    y: disc.y + disc.h / 2,
  };
  const inner = shape.variant === 'donut' ? radius * DONUT_HOLE : 0;
  const paths = slices.flatMap((slice, index) => {
    const sweep = slice.end - slice.start;

    if (sweep <= 1e-9) {
      return [];
    }

    const d =
      sweep >= FULL_TURN - 1e-9
        ? inner <= 0
          ? circlePath(centre, radius)
          : ringPath(centre, radius, inner)
        : slicePath(centre, radius, inner, slice.start, slice.end);

    return [
      filledPath(
        shape,
        context,
        d,
        shape.palette[index % shape.palette.length] ?? 'blue',
        0.9
      ),
    ];
  });
  const key = hasLabels
    ? legend(shape, context, box, disc.x + disc.w, legendWidth)
    : { paths: [], text: [] };

  return {
    children: [],
    paths: [...paths, ...key.paths],
    text: key.text,
  };
};
