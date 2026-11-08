'use client';

import { IconCode, IconPresentation, IconX } from '@tabler/icons-react';
import type { MouseEvent } from 'react';
import { Button } from '~/components/ui/button';
import { CodePanel } from './code-panel';
import { CrashProbe } from './crash-probe';
import { DeckPanel } from './deck-panel';
import { PanelBoundary } from './error-boundary';

/** The two panels the rail offers, in reading order. */
const PANELS = [
  { icon: IconPresentation, id: 'deck', label: 'Slides' },
  { icon: IconCode, id: 'code', label: 'Diagram as code' },
] as const;

/** Which panel is open, or `null` when the rail shows only its buttons. */
export type RailPanel = (typeof PANELS)[number]['id'] | null;

type Props = {
  panel: RailPanel;
  onPanelChange: (panel: RailPanel) => void;
};

/**
 * The top-right rail: two floating buttons that open one panel at a time over
 * the board. The canvas keeps its full width whatever is open, and the panel
 * closes back to the buttons so the rail never becomes a column.
 */
export const RightRail = ({ panel, onPanelChange }: Props) => {
  const choose = (event: MouseEvent<HTMLButtonElement>) => {
    const next = event.currentTarget.dataset.panel;
    if (next === 'deck' || next === 'code') {
      onPanelChange(panel === next ? null : next);
    }
  };
  const close = () => onPanelChange(null);

  return (
    <div className='pointer-events-none absolute top-4 right-4 z-30 flex flex-col items-end gap-2'>
      <div
        aria-label='Panels'
        className='chrome-surface chrome-card pointer-events-auto flex w-10 flex-col gap-0.5 p-1'
        data-testid='rail'
        role='toolbar'
      >
        {PANELS.map(({ id, label, icon: Icon }) => (
          <Button
            aria-controls={`rail-panel-${id}`}
            aria-expanded={panel === id}
            aria-label={label}
            aria-pressed={panel === id}
            className='chrome-icon'
            data-panel={id}
            data-testid={`rail-tab-${id}`}
            key={id}
            onClick={choose}
            size='icon'
            title={label}
            variant={panel === id ? 'secondary' : 'ghost'}
          >
            <Icon />
          </Button>
        ))}
      </div>
      {panel === null ? null : (
        <section
          aria-label={panel === 'deck' ? 'Slides' : 'Diagram as code'}
          className='chrome-surface chrome-card pointer-events-auto flex max-h-[calc(100svh-5rem)] w-[22rem] flex-col overflow-hidden'
          data-testid='rail-panel'
          id={`rail-panel-${panel}`}
        >
          <div className='flex shrink-0 items-center justify-between px-3 py-2'>
            <h2 className='font-medium text-sm'>
              {panel === 'deck' ? 'Slides' : 'Diagram as code'}
            </h2>
            <Button
              aria-label='Close panel'
              className='chrome-icon'
              onClick={close}
              size='icon-xs'
              variant='ghost'
            >
              <IconX />
            </Button>
          </div>
          <div className='min-h-0 flex-1 overflow-hidden'>
            <PanelBoundary label={panel === 'deck' ? 'Deck' : 'Code'}>
              <CrashProbe name={panel}>
                {panel === 'deck' ? <DeckPanel /> : <CodePanel />}
              </CrashProbe>
            </PanelBoundary>
          </div>
        </section>
      )}
    </div>
  );
};
