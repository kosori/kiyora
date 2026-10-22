import type { ChartShape } from '../board/chart';
import { barInk } from './chart-bars';
import { cartesianInk, sparklineInk } from './chart-cartesian';
import { chartBox } from './chart-common';
import { radialInk } from './chart-radial';
import type { Paint, PaintContext } from './paint';

/**
 * Paints one chart: its authored series turned into paths and labels inside its
 * authored box. The kind only decides the painter, so changing it repaints the
 * same numbers, and a box too small to hold its padding paints nothing rather
 * than a negative rectangle. Marks always paint; a context with no measurer
 * leaves the labels out, because a label that was not measured cannot be placed
 * honestly on the canvas or in the export.
 */
export const paintChart = (shape: ChartShape, context: PaintContext): Paint => {
  const box = chartBox(shape);

  if (box === null) {
    return { children: [], paths: [] };
  }

  switch (shape.variant) {
    case 'bar':
      return barInk(shape, context, box);
    case 'pie':
    case 'donut':
      return radialInk(shape, context, box);
    case 'sparkline':
      return sparklineInk(shape, context, box);
    default:
      return cartesianInk(shape, context, box);
  }
};
