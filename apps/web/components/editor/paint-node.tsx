'use client';

import type { Paint } from '@kiyora/model';
import type { ReactNode } from 'react';
import { TextLayer } from './text-layer';

/**
 * One paint node as React elements: its paths, its label, and its children. A
 * clipping node wraps its children in a `clipPath`, so a frame holds its members
 * inside the box its author drew. The canvas and the present surface both render
 * through this, so a slide is drawn by the same walker the board is.
 */
export const PaintNode = ({ paint }: { paint: Paint }): ReactNode => {
  const children = paint.children.map((child, index) => (
    <PaintNode key={child.shapeId ?? `child-${index}`} paint={child} />
  ));

  return (
    <>
      {paint.paths.map((path, index) => (
        <path
          d={path.d}
          fill={path.fill}
          key={`path-${index}`}
          stroke={path.stroke}
          strokeDasharray={path.dash?.join(' ')}
          strokeWidth={path.strokeWidth}
        />
      ))}
      <TextLayer paint={paint} />
      {paint.clip === undefined || paint.shapeId === undefined ? (
        children
      ) : (
        <>
          <clipPath id={`clip-${paint.shapeId}`}>
            <path d={paint.clip} />
          </clipPath>
          <g clipPath={`url(#clip-${paint.shapeId})`}>{children}</g>
        </>
      )}
    </>
  );
};
