'use client';

import { useBoard } from '@kiyora/editor/react';
import { type Paint, paintBoard } from '@kiyora/model';
import type { ReactNode } from 'react';

const PaintPaths = ({ paint }: { paint: Paint }): ReactNode => (
  <>
    {paint.paths.map((path, index) => (
      <path
        d={path.d}
        fill={path.fill}
        key={`path-${index}`}
        stroke={path.stroke}
        strokeWidth={path.strokeWidth}
      />
    ))}
    {paint.children.map((child, index) => (
      <PaintPaths key={`child-${index}`} paint={child} />
    ))}
  </>
);

/** Paints the board. Every coordinate, colour and width comes from the walker. */
export const BoardCanvas = () => {
  const board = useBoard();
  const paint = paintBoard(board, { theme: board.settings.theme });

  return (
    <svg
      aria-label='Board'
      className='h-full w-full'
      data-testid='canvas'
      role='img'
      xmlns='http://www.w3.org/2000/svg'
    >
      <PaintPaths paint={paint} />
    </svg>
  );
};
