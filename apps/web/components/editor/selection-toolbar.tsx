'use client';

import { keyshortcutsFor, runCommand } from '@kiyora/editor';
import { useBoard, useEditor, useSelection } from '@kiyora/editor/react';
import { FIGURE_KINDS } from '@kiyora/model';
import {
  IconAdjustmentsHorizontal,
  IconArrowsSort,
  IconChevronDown,
  IconCircleHalf2,
  IconColorSwatch,
  IconLine,
  IconLock,
  IconLockOpen,
  IconShape,
  IconTypography,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Inspector } from './inspector';
import { usePlatform } from './use-platform';

type Tool = {
  label: string;
  icon: typeof IconAdjustmentsHorizontal;
  testId: string;
};

const TOOLS: readonly Tool[] = [
  { icon: IconAdjustmentsHorizontal, label: 'Style', testId: 'open-style' },
  { icon: IconShape, label: 'Shape', testId: 'open-shape' },
  { icon: IconColorSwatch, label: 'Fill', testId: 'open-fill' },
  { icon: IconLine, label: 'Stroke', testId: 'open-stroke' },
  { icon: IconTypography, label: 'Text', testId: 'open-text' },
  { icon: IconCircleHalf2, label: 'Opacity', testId: 'open-opacity' },
  { icon: IconArrowsSort, label: 'Arrange', testId: 'open-arrange' },
];

/**
 * The selection's contextual bar and its style panel. The bar sits at the
 * bottom centre while something is selected; every styling control opens the
 * one floating panel above it, so the canvas never gives up a column.
 */
export const SelectionToolbar = () => {
  const board = useBoard();
  const editor = useEditor();
  const selection = useSelection();
  const platform = usePlatform();
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => board.shapes.filter((shape) => selection.includes(shape.id)),
    [board.shapes, selection]
  );
  const [first] = selected;
  const anyLocked = selected.some((shape) => shape.locked);
  const canShape =
    first !== undefined &&
    (FIGURE_KINDS as readonly string[]).includes(first.kind);

  useEffect(() => {
    if (selection.length === 0) {
      setOpen(false);
    }
  }, [selection.length]);

  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const lock = useCallback(() => {
    runCommand({ kind: 'lock' }, { editor });
  }, [editor]);

  if (first === undefined) {
    return null;
  }

  return (
    <div className='pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2'>
      {open ? (
        <section
          aria-label='Style'
          className='chrome-surface chrome-card pointer-events-auto absolute bottom-12 left-1/2 flex max-h-[min(60svh,34rem)] w-[19rem] -translate-x-1/2 flex-col overflow-hidden'
          data-testid='styles-panel'
        >
          <div className='flex shrink-0 items-center justify-between px-3 py-2'>
            <h2 className='font-medium text-sm'>Style</h2>
            <Button
              aria-label='Close style panel'
              className='chrome-icon'
              onClick={close}
              size='icon-xs'
              variant='ghost'
            >
              <IconX />
            </Button>
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto'>
            <Inspector />
          </div>
        </section>
      ) : null}
      <div
        aria-label='Selection'
        className='chrome-surface chrome-card pointer-events-auto flex h-10 items-center gap-0.5 p-1'
        data-testid='selection-toolbar'
        role='toolbar'
      >
        {TOOLS.filter((tool) => tool.testId !== 'open-shape' || canShape).map(
          (tool) => {
            const Icon = tool.icon;

            return (
              <Button
                aria-expanded={open}
                aria-label={
                  tool.testId === 'open-opacity'
                    ? `Opacity ${Math.round(first.opacity * 100)}%`
                    : tool.label
                }
                className='chrome-icon h-8 w-auto gap-1 px-2'
                data-testid={tool.testId}
                key={tool.testId}
                onClick={show}
                size='icon'
                title={tool.label}
                variant='ghost'
              >
                <Icon />
                {tool.testId === 'open-opacity' ? (
                  <span className='text-[13px] tabular-nums'>
                    {Math.round(first.opacity * 100)}%
                  </span>
                ) : null}
                <IconChevronDown className='size-3 opacity-50' />
              </Button>
            );
          }
        )}
        <span aria-hidden='true' className='mx-1 h-4 w-px bg-border' />
        <Button
          aria-keyshortcuts={keyshortcutsFor({ kind: 'lock' }, platform)}
          aria-label={anyLocked ? 'Unlock' : 'Lock'}
          aria-pressed={anyLocked}
          className='chrome-icon'
          data-testid='lock-toggle'
          onClick={lock}
          size='icon'
          title={anyLocked ? 'Unlock' : 'Lock'}
          variant='ghost'
        >
          {anyLocked ? <IconLock /> : <IconLockOpen />}
        </Button>
      </div>
    </div>
  );
};
