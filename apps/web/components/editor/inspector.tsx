'use client';

import { useBoard, useSelection } from '@kiyora/editor/react';
import { SelectionStyle } from './selection-style';

/**
 * The right-hand panel: the selection's style, always in view. With nothing
 * selected it says so rather than showing controls that cannot act.
 */
export const Inspector = () => {
  const board = useBoard();
  const selection = useSelection();
  const first = board.shapes.find((shape) => selection.includes(shape.id));

  return (
    <aside
      aria-label='Inspector'
      className='flex h-full w-64 shrink-0 flex-col gap-3 overflow-y-auto border-border border-l bg-background p-3'
      data-testid='inspector'
    >
      <h2 className='font-heading font-medium text-sm'>Style</h2>
      {first === undefined ? (
        <p
          className='text-muted-foreground text-xs'
          data-testid='inspector-empty'
        >
          Select a shape to style it.
        </p>
      ) : (
        <SelectionStyle shape={first} theme={board.settings.theme} />
      )}
    </aside>
  );
};
