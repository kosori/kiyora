'use client';

import { type Alignment, runCommand } from '@kiyora/editor';
import { useEditor } from '@kiyora/editor/react';
import { type MouseEvent, useCallback } from 'react';

type Props = {
  /** Whether three or more shapes are selected, so spacing can mean something. */
  canDistribute: boolean;
};

type AlignOption = {
  alignment: Alignment;
  label: string;
  name: string;
};

const ALIGN_OPTIONS: readonly AlignOption[] = [
  { alignment: 'left', label: 'Left', name: 'Align left' },
  {
    alignment: 'center-horizontal',
    label: 'Centre',
    name: 'Align centre horizontally',
  },
  { alignment: 'right', label: 'Right', name: 'Align right' },
  { alignment: 'top', label: 'Top', name: 'Align top' },
  {
    alignment: 'center-vertical',
    label: 'Middle',
    name: 'Align centre vertically',
  },
  { alignment: 'bottom', label: 'Bottom', name: 'Align bottom' },
];

const HEADING = 'mb-1.5 text-muted-foreground text-xs uppercase tracking-wide';

const BUTTON =
  'rounded-md border border-transparent px-2 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * The selection's arrangement controls. The six alignments appear at two
 * selected shapes and distribution at three; each button hands a command to the
 * one dispatch, so the Inspector, the keymap and the menu run the same code.
 */
export const ArrangeControls = ({ canDistribute }: Props) => {
  const editor = useEditor();
  const pickAlign = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const option = ALIGN_OPTIONS[Number(event.currentTarget.dataset.index)];
      if (option !== undefined) {
        runCommand({ alignment: option.alignment, kind: 'align' }, { editor });
      }
    },
    [editor]
  );
  const pickDistribute = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { axis } = event.currentTarget.dataset;
      if (axis === 'x' || axis === 'y') {
        runCommand({ axis, kind: 'distribute' }, { editor });
      }
    },
    [editor]
  );

  return (
    <section className='flex flex-col gap-3' data-testid='arrange-controls'>
      <div>
        <h3 className={HEADING}>Align</h3>
        <div className='grid grid-cols-3 gap-1'>
          {ALIGN_OPTIONS.map((option, index) => (
            <button
              aria-label={option.name}
              className={BUTTON}
              data-index={index}
              data-testid={`align-${option.alignment}`}
              key={option.alignment}
              onClick={pickAlign}
              type='button'
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {canDistribute ? (
        <div>
          <h3 className={HEADING}>Distribute</h3>
          <div className='grid grid-cols-2 gap-1'>
            <button
              aria-label='Distribute horizontally'
              className={BUTTON}
              data-axis='x'
              data-testid='distribute-x'
              onClick={pickDistribute}
              type='button'
            >
              Horizontal
            </button>
            <button
              aria-label='Distribute vertically'
              className={BUTTON}
              data-axis='y'
              data-testid='distribute-y'
              onClick={pickDistribute}
              type='button'
            >
              Vertical
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};
