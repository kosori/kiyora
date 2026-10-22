import type { ChartShape } from '../board/chart';
import {
  barLabels,
  type ChartLayout,
  horizontalLayout,
  markColour,
  valueAxis,
  xOf,
} from './chart-axis';
import { type ChartBox, filledPath, rectPath } from './chart-common';
import type { Paint, PaintContext, PaintPath } from './paint';

/** The rectangles a bar chart stands on its baseline with. */
const bars = (
  shape: ChartShape,
  context: PaintContext,
  layout: ChartLayout
): PaintPath[] => {
  const { plot, span } = layout;
  const slot = plot.h / shape.series.length;
  const height = Math.max(0.5, slot * 0.7);
  const baseline = xOf(0, span, plot);

  return shape.series.map((value, index) => {
    const edge = xOf(value, span, plot);
    const width = Math.max(Math.abs(edge - baseline), 1);
    const left = value >= 0 ? baseline : baseline - width;

    return filledPath(
      shape,
      context,
      rectPath({
        h: height,
        w: width,
        x: Math.max(plot.x, left),
        y: plot.y + index * slot + (slot - height) / 2,
      }),
      markColour(shape, index),
      0.85
    );
  });
};

/**
 * A horizontal bar chart: its categories down the left, its values across the
 * bottom, and each bar growing from the zero baseline in the palette colour for
 * its category. A negative value grows the other way and a zero value keeps a
 * one-unit sliver, so an empty row is still a row.
 */
export const barInk = (
  shape: ChartShape,
  context: PaintContext,
  box: ChartBox
): Paint => {
  const layout = horizontalLayout(shape, box, context);
  const axis = valueAxis(shape, box, context, layout, true);

  return {
    children: [],
    paths: [...axis.paths, ...bars(shape, context, layout)],
    text: [...axis.text, ...barLabels(shape, context, layout, box)],
  };
};
