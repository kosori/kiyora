'use client';

import { useEditor } from '@kiyora/editor/react';
import { CHART_KINDS, type ChartKind, type ChartShape } from '@kiyora/model';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { OptionButtons } from './option-buttons';

type Props = {
  shape: ChartShape;
};

type Option<T extends string> = {
  label: string;
  value: T;
};

const labelOf = (token: string): string =>
  token.charAt(0).toUpperCase() + token.slice(1);

const KIND_OPTIONS: readonly Option<ChartKind>[] = CHART_KINDS.map((value) => ({
  label: labelOf(value),
  value,
}));

const HEADING = 'mb-1.5 text-muted-foreground text-xs uppercase tracking-wide';

/** The numbers a typed series names: commas, spaces and newlines all separate. */
const numbersOf = (text: string): number[] =>
  text
    .split(/[\s,]+/)
    .filter((part) => part !== '')
    .map((part) => Number(part))
    .filter(Number.isFinite);

/** The categories a typed label row names, comma by comma. */
const labelsOf = (text: string): string[] =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

/**
 * The controls for a selected chart: the kind that draws it, the series it
 * draws, and the category each value belongs to. A series is edited as text and
 * committed once, so the whole replacement is one gesture and one undo — the
 * chart stores numbers, and this is the surface that changes them. The palette
 * travels with the shape; the style panel restyles the shape around it.
 */
export const ChartControls = ({ shape }: Props) => {
  const editor = useEditor();
  const seriesValue = shape.series.join(', ');
  const labelsValue = shape.labels.join(', ');
  const [series, setSeries] = useState(seriesValue);
  const [labels, setLabels] = useState(labelsValue);

  useEffect(() => {
    setSeries(seriesValue);
  }, [seriesValue]);
  useEffect(() => {
    setLabels(labelsValue);
  }, [labelsValue]);

  const pickKind = useCallback(
    (variant: ChartKind) => {
      editor.setChart(shape.id, { variant });
    },
    [editor, shape.id]
  );

  const commitSeries = useCallback(() => {
    const next = numbersOf(series);

    if (next.length > 0) {
      editor.setChart(shape.id, { series: next });
    }
  }, [editor, series, shape.id]);

  const commitLabels = useCallback(() => {
    editor.setChart(shape.id, { labels: labelsOf(labels) });
  }, [editor, labels, shape.id]);

  const changeSeries = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSeries(event.target.value),
    []
  );
  const changeLabels = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setLabels(event.target.value),
    []
  );
  const commitOnEnter = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
    []
  );

  return (
    <section data-testid='chart-controls'>
      <h3 className={HEADING}>Chart</h3>
      <div className='flex flex-col gap-2'>
        <OptionButtons
          label='Kind'
          onPick={pickKind}
          options={KIND_OPTIONS}
          selected={shape.variant}
          testId='chart-kind'
        />
        <label className='flex flex-col gap-1 text-xs' htmlFor='chart-series'>
          Series
          <input
            className='rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
            data-testid='chart-series'
            id='chart-series'
            onBlur={commitSeries}
            onChange={changeSeries}
            onKeyDown={commitOnEnter}
            value={series}
          />
        </label>
        <label className='flex flex-col gap-1 text-xs' htmlFor='chart-labels'>
          Categories
          <input
            className='rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
            data-testid='chart-labels'
            id='chart-labels'
            onBlur={commitLabels}
            onChange={changeLabels}
            onKeyDown={commitOnEnter}
            value={labels}
          />
        </label>
      </div>
    </section>
  );
};
