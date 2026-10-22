import {
  type ChartSpan,
  chartSlices,
  chartSpan,
  chartTicks,
  fractionOf,
  type Measurer,
  textWidth,
  truncateToWidth,
  widestOf,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run) => run.text.length * run.size * 0.5;

const span = (series: readonly number[]): ChartSpan => chartSpan(series);

describe('the span a chart is drawn in', () => {
  it('always includes zero, so a bar has a baseline', () => {
    expect(span([4, 8, 6])).toEqual({ max: 8, min: 0 });
    expect(span([-4, 8])).toEqual({ max: 8, min: -4 });
    expect(span([-4, -8])).toEqual({ max: 0, min: -8 });
    expect(span([5])).toEqual({ max: 5, min: 0 });
  });

  it('never collapses to a zero range, so a mark cannot be placed by dividing by it', () => {
    expect(span([0, 0, 0])).toEqual({ max: 1, min: 0 });
    expect(span([0])).toEqual({ max: 1, min: 0 });
    expect(span([])).toEqual({ max: 1, min: 0 });
  });

  it('ignores a value that is not a finite number rather than letting it poison the span', () => {
    expect(span([2, Number.NaN, 6, Number.POSITIVE_INFINITY])).toEqual({
      max: 6,
      min: 0,
    });
  });

  it('places a value between the floor and the ceiling, clamped', () => {
    expect(fractionOf(0, { max: 10, min: 0 })).toBe(0);
    expect(fractionOf(5, { max: 10, min: 0 })).toBe(0.5);
    expect(fractionOf(10, { max: 10, min: 0 })).toBe(1);
    expect(fractionOf(-5, { max: 10, min: 0 })).toBe(0);
    expect(fractionOf(15, { max: 10, min: 0 })).toBe(1);
    expect(fractionOf(-5, { max: 0, min: -10 })).toBe(0.5);
  });
});

describe('the ticks a span is read with', () => {
  it('takes a step a reader recognises, rather than an even division', () => {
    expect(chartTicks({ max: 10, min: 0 }).map((tick) => tick.label)).toEqual([
      '0',
      '2.5',
      '5',
      '7.5',
      '10',
    ]);
  });

  it('stays inside the span and keeps the floor and ceiling readable', () => {
    const ticks = chartTicks({ max: 0, min: -8 });

    expect(ticks.map((tick) => tick.label)).toEqual([
      '-8',
      '-6',
      '-4',
      '-2',
      '0',
    ]);
    expect(
      ticks.every((tick) => tick.fraction >= 0 && tick.fraction <= 1)
    ).toBe(true);
  });

  it('gives a zero-height span one floor tick rather than an empty axis', () => {
    expect(chartTicks({ max: 0, min: 0 })).toEqual([
      { fraction: 0, label: '0', value: 0 },
    ]);
  });

  it('reads an all-zero series with quarter ticks, not a collapsed axis', () => {
    expect(chartTicks(chartSpan([0])).map((tick) => tick.label)).toEqual([
      '0',
      '0.25',
      '0.5',
      '0.75',
      '1',
    ]);
  });

  it('is the same every time, so a golden can exist', () => {
    const once = chartTicks({ max: 37, min: -11 });
    const twice = chartTicks({ max: 37, min: -11 });

    expect(twice).toEqual(once);
  });

  it('keeps a tiny value legible with an exponent instead of rounding it to zero', () => {
    const ticks = chartTicks({ max: 0.002, min: 0 });

    expect(ticks.some((tick) => tick.label.includes('e-'))).toBe(true);
  });
});

describe('the slices a pie or a donut is cut into', () => {
  it('gives every category a wedge proportional to its magnitude', () => {
    const slices = chartSlices([1, 1, 2]);

    expect(slices.map((slice) => slice.end - slice.start)).toEqual([
      Math.PI / 2,
      Math.PI / 2,
      Math.PI,
    ]);
  });

  it('starts at twelve o’clock and closes the full turn', () => {
    const slices = chartSlices([3, 1]);
    const last = slices.at(-1);

    expect(slices[0]?.start).toBeCloseTo(-Math.PI / 2);
    expect(last?.end).toBeCloseTo((Math.PI * 3) / 2);
  });

  it('cuts an all-zero series into equal wedges rather than an empty pie', () => {
    const slices = chartSlices([0, 0, 0, 0]);

    expect(slices.map((slice) => slice.end - slice.start)).toEqual([
      Math.PI / 2,
      Math.PI / 2,
      Math.PI / 2,
      Math.PI / 2,
    ]);
  });

  it('uses a negative value’s magnitude, so it still has a wedge', () => {
    const slices = chartSlices([-2, 1]);

    expect((slices[0]?.end ?? 0) - (slices[0]?.start ?? 0)).toBeCloseTo(
      (Math.PI * 4) / 3
    );
    expect((slices[1]?.end ?? 0) - (slices[1]?.start ?? 0)).toBeCloseTo(
      (Math.PI * 2) / 3
    );
  });

  it('has no slices for no series', () => {
    expect(chartSlices([])).toEqual([]);
  });
});

describe('the room a label is given', () => {
  it('measures through the injected measurer, not a constant', () => {
    expect(textWidth(fake, 'Wed', 10)).toBe(15);
    expect(textWidth(fake, 'Wed', 20)).toBe(30);
    expect(textWidth(undefined, 'Wed', 10)).toBe(0);
  });

  it('leaves a label that fits exactly as it was typed', () => {
    expect(truncateToWidth('Wed', 30, fake, 10)).toBe('Wed');
  });

  it('shortens a label that does not fit, with an ellipsis it measured', () => {
    const fitted = truncateToWidth('Wednesday', 30, fake, 10);

    expect(fitted).toBe('Wedne…');
    expect(textWidth(fake, fitted, 10)).toBeLessThanOrEqual(30);
  });

  it('drops a label when not even the ellipsis fits the room', () => {
    expect(truncateToWidth('Wednesday', 4, fake, 10)).toBe('');
  });

  it('drops an empty label and keeps text when there is no measurer', () => {
    expect(truncateToWidth('', 20, fake, 10)).toBe('');
    expect(truncateToWidth('Wed', 20, undefined, 10)).toBe('Wed');
  });

  it('reports the widest of a set of labels', () => {
    expect(widestOf(['Tue', 'Wednesday', 'Mon'], fake, 10)).toBe(45);
    expect(widestOf(['Tue'], undefined, 10)).toBe(0);
  });
});
