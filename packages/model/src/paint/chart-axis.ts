import type { ChartShape } from '../board/chart';
import {
  type ChartSpan,
  type ChartTick,
  chartSpan,
  chartTicks,
  fractionOf,
  widestOf,
} from '../chart/scale';
import { formatNumber } from '../format';
import type { PaintText } from '../text/layout';
import {
  CHART_LABEL_SIZE,
  type ChartBox,
  chartLabel,
  rulePath,
} from './chart-common';
import type { PaintContext, PaintPath } from './paint';

/** What a cartesian painter lays out: the plot, the span and the labels it can fit. */
export type ChartLayout = {
  categories: boolean;
  plot: ChartBox;
  span: ChartSpan;
  ticks: ChartTick[];
};

/** The y of a value in a plot that grows upwards. */
export const yOf = (value: number, span: ChartSpan, plot: ChartBox): number =>
  plot.y + (1 - fractionOf(value, span)) * plot.h;

/** The x of a value in a plot that grows rightwards. */
export const xOf = (value: number, span: ChartSpan, plot: ChartBox): number =>
  plot.x + fractionOf(value, span) * plot.w;

/** The category labels a chart can paint, taken in series order and trimmed to its length. */
export const categoriesOf = (shape: ChartShape): string[] =>
  shape.series.map((_, index) => shape.labels[index] ?? '');

/** The series mark's colour: bars and columns colour each category, a line one series. */
export const markColour = (shape: ChartShape, index: number) =>
  shape.palette[index % shape.palette.length] ?? shape.palette[0] ?? 'blue';

/**
 * The room a vertical chart spends on its value axis and its category row, or no
 * room at all when the box cannot hold both. The value inset follows the widest
 * measured tick label, capped so a long label can never swallow the plot.
 */
export const verticalLayout = (
  shape: ChartShape,
  box: ChartBox,
  context: PaintContext
): ChartLayout => {
  const span = chartSpan(shape.series);
  const ticks = chartTicks(span);
  const { measure } = context;
  const categories = categoriesOf(shape);
  const hasCategories = categories.some((label) => label.trim() !== '');
  const valueInset =
    measure === undefined
      ? 0
      : Math.min(
          widestOf(
            ticks.map((tick) => tick.label),
            measure,
            CHART_LABEL_SIZE
          ) + 6,
          box.w * 0.35
        );
  const categoryInset =
    measure === undefined || !hasCategories ? 0 : CHART_LABEL_SIZE * 1.7;
  const plot = {
    h: box.h - categoryInset,
    w: box.w - valueInset,
    x: box.x + valueInset,
    y: box.y,
  };

  if (plot.w < 2 || plot.h < 2) {
    return { categories: false, plot: box, span, ticks };
  }

  return { categories: hasCategories, plot, span, ticks };
};

/** The room a horizontal chart spends on its value axis and its category column. */
export const horizontalLayout = (
  shape: ChartShape,
  box: ChartBox,
  context: PaintContext
): ChartLayout => {
  const span = chartSpan(shape.series);
  const ticks = chartTicks(span);
  const { measure } = context;
  const categories = categoriesOf(shape);
  const hasCategories = categories.some((label) => label.trim() !== '');
  const categoryInset =
    measure === undefined || !hasCategories
      ? 0
      : Math.min(
          widestOf(categories, measure, CHART_LABEL_SIZE) + 6,
          box.w * 0.35
        );
  const valueInset = measure === undefined ? 0 : CHART_LABEL_SIZE * 1.7;
  const plot = {
    h: box.h - valueInset,
    w: box.w - categoryInset,
    x: box.x + categoryInset,
    y: box.y,
  };

  if (plot.w < 2 || plot.h < 2) {
    return { categories: false, plot: box, span, ticks };
  }

  return { categories: hasCategories, plot, span, ticks };
};

/** The gridlines and the value labels a cartesian chart reads its series against. */
export const valueAxis = (
  shape: ChartShape,
  box: ChartBox,
  context: PaintContext,
  layout: ChartLayout,
  horizontal: boolean
): { paths: PaintPath[]; text: PaintText[] } => {
  const { plot, span, ticks } = layout;
  const paths: PaintPath[] = [];
  const text: PaintText[] = [];

  for (const tick of ticks) {
    if (horizontal) {
      const x = xOf(tick.value, span, plot);
      paths.push(
        rulePath(
          shape,
          context,
          `M ${formatNumber(x)} ${formatNumber(plot.y)} L ${formatNumber(x)} ${formatNumber(plot.y + plot.h)}`,
          0.12
        )
      );
      const label = chartLabel(
        shape,
        context,
        tick.label,
        x,
        plot.y + plot.h + CHART_LABEL_SIZE * 1.3,
        'center'
      );
      if (label !== null) {
        text.push(label);
      }
    } else {
      const y = yOf(tick.value, span, plot);
      paths.push(
        rulePath(
          shape,
          context,
          `M ${formatNumber(plot.x)} ${formatNumber(y)} L ${formatNumber(plot.x + plot.w)} ${formatNumber(y)}`,
          0.12
        )
      );
      const label = chartLabel(
        shape,
        context,
        tick.label,
        box.x + (plot.x - box.x) - 4,
        y + CHART_LABEL_SIZE * 0.35,
        'right'
      );
      if (label !== null) {
        text.push(label);
      }
    }
  }

  return { paths, text };
};

/** The category labels a column-like chart paints under its categories. */
export const columnLabels = (
  shape: ChartShape,
  context: PaintContext,
  layout: ChartLayout
): PaintText[] => {
  if (!layout.categories) {
    return [];
  }
  const { plot } = layout;
  const slot = plot.w / shape.series.length;

  return categoriesOf(shape).flatMap((label, index) => {
    const placed = chartLabel(
      shape,
      context,
      label,
      plot.x + (index + 0.5) * slot,
      plot.y + plot.h + CHART_LABEL_SIZE * 1.3,
      'center',
      slot - 4
    );

    return placed === null ? [] : [placed];
  });
};

/** The category labels a bar chart paints beside its rows. */
export const barLabels = (
  shape: ChartShape,
  context: PaintContext,
  layout: ChartLayout,
  box: ChartBox
): PaintText[] => {
  if (!layout.categories) {
    return [];
  }
  const slot = layout.plot.h / shape.series.length;
  const width = layout.plot.x - box.x - 6;

  return categoriesOf(shape).flatMap((label, index) => {
    const placed = chartLabel(
      shape,
      context,
      label,
      box.x + width,
      layout.plot.y + (index + 0.5) * slot + CHART_LABEL_SIZE * 0.35,
      'right',
      width
    );

    return placed === null ? [] : [placed];
  });
};
