import { formatNumber } from '../format';
import type { Measurer } from '../text/wrap';

/**
 * The value span a chart maps into its box. Zero is always inside it, so a bar
 * has a baseline to stand on whether its series is positive, negative or both;
 * the span is never empty, so the arithmetic that places a mark never divides by
 * a zero range. A span with no height — every value zero, or the one value zero —
 * grows upwards by one unit, which paints an empty chart with a readable axis.
 */
export type ChartSpan = {
  max: number;
  min: number;
};

/** The span a series is drawn in, with zero inside it and a height that is never zero. */
export const chartSpan = (series: readonly number[]): ChartSpan => {
  let min = 0;
  let max = 0;

  for (const value of series) {
    if (Number.isFinite(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  return min === max ? { max: min + 1, min } : { max, min };
};

/** Where `value` sits in `span`, from 0 at its floor to 1 at its ceiling. */
export const fractionOf = (value: number, span: ChartSpan): number => {
  const range = span.max - span.min;

  if (!Number.isFinite(range) || range <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, (value - span.min) / range));
};

/** A tick's label: a small value keeps a readable exponent rather than rounding to nothing. */
const tickLabel = (value: number): string =>
  value !== 0 && Math.abs(value) < 0.001
    ? value.toExponential(1)
    : formatNumber(value);

/** One gridline: the value it marks, where that value sits, and the text a reader sees. */
export type ChartTick = {
  fraction: number;
  label: string;
  value: number;
};

/** The steps a nice axis may take before the next power of ten. */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/**
 * The gridlines a span is read with. The step is a power of ten times one of the
 * four steps a reader recognises, so labels are 0, 5, 10 rather than 0, 3.7,
 * 7.4, and the same span always produces the same ticks. A zero-height span —
 * which cannot occur from `chartSpan` — still yields its one floor tick rather
 * than an empty axis.
 */
export const chartTicks = (span: ChartSpan, count = 4): ChartTick[] => {
  const range = span.max - span.min;

  if (!(range > 0)) {
    return [{ fraction: 0, label: tickLabel(span.min), value: span.min }];
  }

  const rough = range / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normal = rough / magnitude;
  const step =
    magnitude * (NICE_STEPS.find((candidate) => normal <= candidate) ?? 10);
  const first = Math.ceil(span.min / step - 1e-9) * step;
  const ticks: ChartTick[] = [];

  for (let value = first; value <= span.max + step * 1e-9; value += step) {
    const rounded = Number(value.toFixed(9));
    ticks.push({
      fraction: fractionOf(rounded, span),
      label: tickLabel(rounded),
      value: rounded,
    });
  }

  return ticks.length === 0
    ? [{ fraction: 0, label: tickLabel(span.min), value: span.min }]
    : ticks;
};

/** One slice of a pie or a donut: the angles it sweeps, in radians. */
export type ChartSlice = {
  end: number;
  start: number;
  value: number;
};

/** A full turn, in radians. */
const FULL_TURN = Math.PI * 2;

/**
 * The slices a series becomes. A slice is as wide as its value's magnitude, so a
 * negative value still has a wedge rather than a negative angle; a series that
 * sums to zero — every value zero, or a single zero — gives every category an
 * equal wedge, because an empty pie tells a reader nothing. The first slice
 * starts at twelve o'clock and every slice follows clockwise.
 */
export const chartSlices = (
  series: readonly number[],
  turn: number = FULL_TURN
): ChartSlice[] => {
  const weights = series.map((value) =>
    Number.isFinite(value) ? Math.abs(value) : 0
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const equal = series.length === 0 ? 0 : 1 / series.length;
  let angle = -Math.PI / 2;

  return series.map((value, index) => {
    const share = total === 0 ? equal : (weights[index] ?? 0) / total;
    const start = angle;
    angle += share * turn;

    return { end: angle, start, value };
  });
};

/** The width `text` measures at `size`, or zero when the context has no measurer. */
export const textWidth = (
  measure: Measurer | undefined,
  text: string,
  size: number
): number =>
  measure === undefined
    ? 0
    : measure({ bold: false, code: false, italic: false, size, text });

/**
 * The longest start of `text` that still fits `maxWidth` with an ellipsis, or an
 * empty string when not even the ellipsis fits. Every width comes from the
 * injected measurer, so a truncated label is as wide on the canvas as in the
 * export; a label that fits is left exactly as it was typed.
 */
export const truncateToWidth = (
  text: string,
  maxWidth: number,
  measure: Measurer | undefined,
  size: number
): string => {
  if (text === '' || maxWidth <= 0) {
    return '';
  }
  if (measure === undefined) {
    return text;
  }

  if (textWidth(measure, text, size) <= maxWidth) {
    return text;
  }

  const ellipsis = '…';

  if (textWidth(measure, ellipsis, size) > maxWidth) {
    return '';
  }

  let end = text.length;

  while (
    end > 0 &&
    textWidth(measure, `${text.slice(0, end)}${ellipsis}`, size) > maxWidth
  ) {
    end -= 1;
  }

  return end === 0 ? '' : `${text.slice(0, end)}${ellipsis}`;
};

/** The widest of `texts` at `size`, or zero with no measurer. */
export const widestOf = (
  texts: readonly string[],
  measure: Measurer | undefined,
  size: number
): number =>
  texts.reduce(
    (widest, text) => Math.max(widest, textWidth(measure, text, size)),
    0
  );
