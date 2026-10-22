'use client';

import { type MouseEvent, useCallback, useState } from 'react';
import { CodePanel } from './code-panel';
import { CrashProbe } from './crash-probe';
import { DeckPanel } from './deck-panel';
import { PanelBoundary } from './error-boundary';
import { Inspector } from './inspector';

/** The three panels the right rail offers, in reading order. */
const TABS = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'deck', label: 'Deck' },
  { id: 'code', label: 'Code' },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** Whether `value` names a tab, so a data attribute narrows without a cast. */
const isTab = (value: string | undefined): value is Tab =>
  TABS.some((tab) => tab.id === value);

/**
 * The right rail: one column, three panels. A tab decides which panel is on
 * screen, so opening the code panel never takes width from the canvas — the
 * rail keeps the column the inspector and the deck already shared. Each panel
 * stays behind its own boundary, so one crashing panel cannot take the board.
 */
export const RightRail = () => {
  const [active, setActive] = useState<Tab>('inspector');
  const select = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const next = event.currentTarget.dataset.tab;
    if (isTab(next)) {
      setActive(next);
    }
  }, []);

  return (
    <aside
      aria-label='Panels'
      className='flex h-full w-64 shrink-0 flex-col border-border border-l bg-background'
      data-testid='rail'
    >
      <div
        aria-label='Panel sections'
        className='flex shrink-0 border-border border-b'
        role='tablist'
      >
        {TABS.map((tab) => (
          <button
            aria-controls={`rail-panel-${tab.id}`}
            aria-selected={active === tab.id}
            className={`flex-1 border-b-2 px-1 py-2 text-xs ${
              active === tab.id
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-tab={tab.id}
            data-testid={`rail-tab-${tab.id}`}
            id={`rail-tab-${tab.id}`}
            key={tab.id}
            onClick={select}
            role='tab'
            type='button'
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        aria-labelledby='rail-tab-inspector'
        className='min-h-0 flex-1 overflow-hidden'
        hidden={active !== 'inspector'}
        id='rail-panel-inspector'
        role='tabpanel'
      >
        <PanelBoundary label='Inspector'>
          <CrashProbe name='inspector'>
            <Inspector />
          </CrashProbe>
        </PanelBoundary>
      </div>
      <div
        aria-labelledby='rail-tab-deck'
        className='min-h-0 flex-1 overflow-hidden'
        hidden={active !== 'deck'}
        id='rail-panel-deck'
        role='tabpanel'
      >
        <PanelBoundary label='Deck'>
          <CrashProbe name='deck'>
            <DeckPanel />
          </CrashProbe>
        </PanelBoundary>
      </div>
      <div
        aria-labelledby='rail-tab-code'
        className='min-h-0 flex-1 overflow-hidden'
        hidden={active !== 'code'}
        id='rail-panel-code'
        role='tabpanel'
      >
        <PanelBoundary label='Code'>
          <CrashProbe name='code'>
            <CodePanel />
          </CrashProbe>
        </PanelBoundary>
      </div>
    </aside>
  );
};
