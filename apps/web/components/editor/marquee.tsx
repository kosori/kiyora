'use client';

import { useBoard, useGesture } from '@kiyora/editor/react';
import { paintColour } from '@kiyora/model';

/**
 * The box a marquee is sweeping, drawn in board coordinates so it hugs the
 * shapes it will cover. Display-only, and gone the moment the gesture closes.
 */
export const Marquee = () => {
  const board = useBoard();
  const gesture = useGesture();

  if (gesture.kind !== 'marquee') {
    return null;
  }

  const { box } = gesture;
  const { theme } = board.settings;

  return (
    <rect
      data-testid='marquee'
      fill={paintColour('blue', theme, 0.1)}
      height={box.h}
      pointerEvents='none'
      stroke={paintColour('blue', theme)}
      strokeDasharray='4 2'
      strokeWidth={1}
      vectorEffect='non-scaling-stroke'
      width={box.w}
      x={box.x}
      y={box.y}
    />
  );
};
