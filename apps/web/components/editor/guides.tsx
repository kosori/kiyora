'use client';

import { useBoard, useGesture } from '@kiyora/editor/react';
import { paintColour } from '@kiyora/model';

/**
 * The alignment guides the open gesture has landed on, drawn in board
 * coordinates so they run between the boxes they join. Display-only: the lines
 * come from the gesture and never from the board, so they reach no export, no
 * history entry and no save, and they are gone the moment the pointer lifts.
 */
export const Guides = () => {
  const board = useBoard();
  const gesture = useGesture();
  const guides =
    gesture.kind === 'move' || gesture.kind === 'resize' ? gesture.guides : [];

  if (guides.length === 0) {
    return null;
  }

  const colour = paintColour('pink', board.settings.theme);

  return (
    <g data-testid='guides' pointerEvents='none'>
      {guides.map((guide) => (
        <line
          data-axis={guide.axis}
          data-testid={`guide-${guide.axis}`}
          key={guide.axis}
          stroke={colour}
          strokeDasharray='4 2'
          strokeWidth={1}
          vectorEffect='non-scaling-stroke'
          x1={guide.axis === 'x' ? guide.value : guide.start}
          x2={guide.axis === 'x' ? guide.value : guide.end}
          y1={guide.axis === 'x' ? guide.start : guide.value}
          y2={guide.axis === 'x' ? guide.end : guide.value}
        />
      ))}
    </g>
  );
};
