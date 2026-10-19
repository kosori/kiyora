'use client';

import { selectionBounds } from '@kiyora/editor';
import { useBoard, useSelection } from '@kiyora/editor/react';
import { paintColour } from '@kiyora/model';

/**
 * The frame around the selection, drawn in board coordinates inside the camera's
 * group. Display-only: it never reaches an artifact. The eight resize handles
 * arrive with their own ticket; this is the frame they will sit on.
 */
export const SelectionFrame = () => {
  const board = useBoard();
  const selection = useSelection();
  const bounds = selectionBounds(board, selection);

  if (bounds === null) {
    return null;
  }

  return (
    <rect
      data-testid='selection-frame'
      fill='none'
      height={bounds.h}
      pointerEvents='none'
      stroke={paintColour('blue', board.settings.theme)}
      strokeWidth={1.5}
      vectorEffect='non-scaling-stroke'
      width={bounds.w}
      x={bounds.x}
      y={bounds.y}
    />
  );
};
