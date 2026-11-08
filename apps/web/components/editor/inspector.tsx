'use client';

import { arrangementOf } from '@kiyora/editor';
import { useBoard, useSelection } from '@kiyora/editor/react';
import { ArrangeControls } from './arrange-controls';
import { ChartControls } from './chart-controls';
import { ConnectorStyle } from './connector-style';
import { FrameControls } from './frame-controls';
import { SelectionStyle } from './selection-style';
import { TableControls } from './table-controls';

/**
 * The selection's style controls, rendered inside the floating style panel.
 * With nothing selected it says so rather than showing controls that cannot act.
 */
export const Inspector = () => {
  const board = useBoard();
  const selection = useSelection();
  const selected = board.shapes.filter((shape) => selection.includes(shape.id));
  const [first] = selected;
  const { canAlign, canDistribute } = arrangementOf(board, selection);
  const hasLocked = board.shapes.some((shape) => shape.locked);

  return (
    <section className='flex flex-col gap-3 px-3 pb-3' data-testid='inspector'>
      {first === undefined ? (
        <div className='flex flex-col gap-2'>
          <p
            className='text-muted-foreground text-xs'
            data-testid='inspector-empty'
          >
            Select a shape to style it.
          </p>
          {hasLocked ? (
            <p
              className='text-muted-foreground text-xs'
              data-testid='locked-hint'
            >
              Alt-click a locked shape to select it, then unlock it here.
            </p>
          ) : null}
        </div>
      ) : (
        <div className='flex flex-col gap-4'>
          {canAlign ? <ArrangeControls canDistribute={canDistribute} /> : null}
          {first.kind === 'frame' ? <FrameControls shape={first} /> : null}
          {first.kind === 'data-table' ? <TableControls shape={first} /> : null}
          {first.kind === 'chart' ? <ChartControls shape={first} /> : null}
          {first.kind === 'connector' ? <ConnectorStyle shape={first} /> : null}
          <SelectionStyle shape={first} theme={board.settings.theme} />
        </div>
      )}
    </section>
  );
};
