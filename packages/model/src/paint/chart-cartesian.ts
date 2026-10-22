import type { ChartShape } from '../board/chart';
import { chartSpan } from '../chart/scale';
import { formatNumber } from '../format';
import {
  type ChartLayout,
  columnLabels,
  markColour,
  valueAxis,
  verticalLayout,
  yOf,
} from './chart-axis';
import {
  type ChartBox,
  chartStroke,
  dotPath,
  dotRadius,
  filledPath,
  rectPath,
  strokedPath,
} from './chart-common';
import type { Paint, PaintContext, PaintPath } from './paint';

/** The rectangles a column chart stands on its baseline with. */
const columns = (
  shape: ChartShape,
  context: PaintContext,
  layout: ChartLayout
): PaintPath[] => {
  const { plot, span } = layout;
  const slot = plot.w / shape.series.length;
  const width = Math.max(0.5, slot * 0.7);
  const baseline = yOf(0, span, plot);

  return shape.series.map((value, index) => {
    const edge = yOf(value, span, plot);
    const height = Math.max(Math.abs(edge - baseline), 1);
    const top = value >= 0 ? baseline - height : baseline;

    return filledPath(
      shape,
      context,
      rectPath({
        h: height,
        w: width,
        x: plot.x + index * slot + (slot - width) / 2,
        y: Math.max(plot.y, top),
      }),
      markColour(shape, index),
      0.85
    );
  });
};

/** One point per category, in the plot's own coordinates. */
const points = (
  shape: ChartShape,
  layout: ChartLayout
): { x: number; y: number }[] => {
  const slot = layout.plot.w / shape.series.length;

  return shape.series.map((value, index) => ({
    x: layout.plot.x + (index + 0.5) * slot,
    y: yOf(value, layout.span, layout.plot),
  }));
};

/** The polyline through every point, or a dot when a line has only one point. */
const lineMark = (
  shape: ChartShape,
  context: PaintContext,
  layout: ChartLayout,
  colourIndex = 0
): PaintPath => {
  const places = points(shape, layout);
  const [first] = places;

  if (first === undefined) {
    return filledPath(shape, context, '', markColour(shape, 0), 0);
  }
  if (places.length === 1) {
    return filledPath(
      shape,
      context,
      dotPath(first.x, first.y, dotRadius(layout.plot)),
      markColour(shape, colourIndex),
      1
    );
  }

  const d = places
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`
    )
    .join(' ');

  return strokedPath(
    shape,
    context,
    d,
    markColour(shape, colourIndex),
    chartStroke(shape)
  );
};

/** The band an area chart fills down to its baseline, plus the line along its top. */
const areaMark = (
  shape: ChartShape,
  context: PaintContext,
  layout: ChartLayout
): PaintPath[] => {
  const line = lineMark(shape, context, layout);
  const places = points(shape, layout);
  const [first] = places;

  if (first === undefined || places.length < 2) {
    return [line];
  }

  const last = places.at(-1) as { x: number; y: number };
  const baseline = yOf(0, layout.span, layout.plot);
  const d = [
    `M ${formatNumber(first.x)} ${formatNumber(baseline)}`,
    ...places.map(
      (point) => `L ${formatNumber(point.x)} ${formatNumber(point.y)}`
    ),
    `L ${formatNumber(last.x)} ${formatNumber(baseline)} Z`,
  ].join(' ');

  return [filledPath(shape, context, d, markColour(shape, 0), 0.22), line];
};

/** The dots a scatter chart paints, one per category. */
const scatterMarks = (
  shape: ChartShape,
  context: PaintContext,
  layout: ChartLayout
): PaintPath[] => {
  const radius = dotRadius(layout.plot);

  return points(shape, layout).map((point, index) =>
    filledPath(
      shape,
      context,
      dotPath(point.x, point.y, radius),
      markColour(shape, index),
      1
    )
  );
};

/** The painter for every chart whose values sit on a vertical cartesian axis. */
export const cartesianInk = (
  shape: ChartShape,
  context: PaintContext,
  box: ChartBox
): Paint => {
  const layout = verticalLayout(shape, box, context);
  const axis = valueAxis(shape, box, context, layout, false);
  let paths: PaintPath[];

  switch (shape.variant) {
    case 'column':
      paths = columns(shape, context, layout);
      break;
    case 'area':
      paths = areaMark(shape, context, layout);
      break;
    case 'line':
      paths = [lineMark(shape, context, layout)];
      break;
    case 'scatter':
      paths = scatterMarks(shape, context, layout);
      break;
    default:
      paths = [];
  }

  return {
    children: [],
    paths: [...axis.paths, ...paths],
    text: [...axis.text, ...columnLabels(shape, context, layout)],
  };
};

/**
 * A sparkline: the same line a line chart draws, with no axis, no gridlines and
 * no labels. It shares the series, the span and the dot a single point paints,
 * so it is a chart kind and not a second drawing.
 */
export const sparklineInk = (
  shape: ChartShape,
  context: PaintContext,
  box: ChartBox
): Paint => {
  const layout: ChartLayout = {
    categories: false,
    plot: box,
    span: chartSpan(shape.series),
    ticks: [],
  };

  return { children: [], paths: [lineMark(shape, context, layout)] };
};
