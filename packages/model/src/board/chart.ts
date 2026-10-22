import { z } from 'zod';
import { paletteColourSchema } from '../paint/palette';
import { shapeBaseSchema } from './shape-base';

/**
 * The eight ways a chart draws its series. A kind carries data, not a picture of
 * it: the same series repaints as any of them, which is what makes the kind a
 * choice a person makes after placing the shape rather than at import time.
 */
export const CHART_KINDS = [
  'bar',
  'column',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'sparkline',
] as const;

/** One way a chart draws its series. */
export const chartKindSchema = z.enum(CHART_KINDS);

/** One way a chart draws its series. */
export type ChartKind = z.infer<typeof chartKindSchema>;

/**
 * The most values one chart may hold. A chart is authored data, so the cap is
 * the one a box can still paint legibly: five hundred marks is already a density
 * no label fits, and beyond it a hand-edited file grows without bound.
 */
export const MAX_CHART_VALUES = 512;

/** The colours a fresh chart cycles through, in the palette's own order. */
export const CHART_PALETTE = [
  'blue',
  'orange',
  'green',
  'violet',
  'teal',
  'pink',
  'red',
  'yellow',
] as const satisfies readonly z.infer<typeof paletteColourSchema>[];

/** The series a fresh chart lands with: four categories, one per label. */
export const CHART_SERIES = [4, 8, 6, 10] as const;

/** The category labels a fresh chart lands with. */
export const CHART_LABELS = ['A', 'B', 'C', 'D'] as const;

/**
 * A chart: a series of numbers, the category each one belongs to, and the
 * palette colours the marks cycle through. The numbers are authored and stored,
 * so changing one repaints the chart instead of replacing a drawing; the kind is
 * a variant rather than a second shape type, so one chart can become another
 * without losing its data. Labels and colours default, so a hand-written shape
 * is a series and a kind.
 */
export const chartSchema = shapeBaseSchema.extend({
  kind: z.literal('chart'),
  labels: z.array(z.string()).default([...CHART_LABELS]),
  palette: z
    .array(paletteColourSchema)
    .min(1)
    .default([...CHART_PALETTE]),
  series: z.array(z.number()).min(1).max(MAX_CHART_VALUES),
  variant: chartKindSchema,
});

/** A chart: an editable series drawn as bars, lines, areas, points or slices. */
export type ChartShape = z.infer<typeof chartSchema>;
