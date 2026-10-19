'use client';

import {
  fontFamilyOf,
  type Paint,
  type Run,
  textAnchorOf,
} from '@kiyora/model';
import type { ReactNode } from 'react';

/**
 * One run, as a `tspan` — inside a real anchor when it is a link. The family and
 * the weight come from the run, so a code run reads as code and the export draws
 * the same span.
 */
const renderRun = (run: Run, key: number): ReactNode => {
  const span = (
    <tspan
      fontFamily={fontFamilyOf(run)}
      fontStyle={run.italic ? 'italic' : undefined}
      fontWeight={run.bold ? 'bold' : undefined}
      key={key}
    >
      {run.text}
    </tspan>
  );

  return run.href === null ? (
    span
  ) : (
    <a href={run.href} key={key} rel='noopener noreferrer' target='_blank'>
      {span}
    </a>
  );
};

/**
 * The label of one painted node, as SVG text the browser lays out exactly as the
 * projector's string does. The fill is the model's foreground ink, so a label is
 * never the invisible `none` that once shipped.
 */
export const TextLayer = ({ paint }: { paint: Paint }): ReactNode => (
  <>
    {(paint.text ?? []).map((line, index) => (
      <text
        fill={line.fill}
        fontSize={line.size}
        key={`text-${index}`}
        textAnchor={textAnchorOf(line.align)}
        transform={line.transform}
        x={line.x}
        y={line.y}
      >
        {line.runs.map((run, runIndex) => renderRun(run, runIndex))}
      </text>
    ))}
  </>
);
