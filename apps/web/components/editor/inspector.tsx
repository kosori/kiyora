'use client';

import { arrangementOf } from '@kiyora/editor';
import { useBoard, useSelection } from '@kiyora/editor/react';
import { ArrangeControls } from './arrange-controls';
import { BoardTheme } from './board-theme';
import { ChartControls } from './chart-controls';
import { ConnectorStyle } from './connector-style';
import { FrameControls } from './frame-controls';
import { LockControl } from './lock-control';
import { SelectionStyle } from './selection-style';

/**
 * The right-hand panel: the selection's style, always in view, plus a
 * connector's own route and heads. With nothing selected it says so rather than
 * showing controls that cannot act.
 */
export const Inspector = () => {
  const board = useBoard();
  const selection = useSelection();
  const selected = board.shapes.filter((shape) => selection.includes(shape.id));
  const [first] = selected;
  const { canAlign, canDistribute } = arrangementOf(board, selection);
  const anyLocked = selected.some((shape) => shape.locked);
  const hasLocked = board.shapes.some((shape) => shape.locked);

  return (
    <section
      className='flex h-full flex-col gap-3 overflow-y-auto p-3'
      data-testid='inspector'
    >
      <h2 className='font-heading font-medium text-sm'>Style</h2>
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
          <LockControl locked={anyLocked} />
          {canAlign ? <ArrangeControls canDistribute={canDistribute} /> : null}
          {first.kind === 'frame' ? <FrameControls shape={first} /> : null}
          {first.kind === 'chart' ? <ChartControls shape={first} /> : null}
          {first.kind === 'connector' ? <ConnectorStyle shape={first} /> : null}
          <SelectionStyle shape={first} theme={board.settings.theme} />
        </div>
      )}
      <BoardTheme />
    </section>
  );
};
