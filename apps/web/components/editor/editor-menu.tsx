'use client';

import type { LibraryEntry } from '@kiyora/editor';
import { IconHelpCircle, IconLayoutGrid, IconMenu2 } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { AppearanceControl } from './appearance-control';
import { BoardTheme } from './board-theme';
import { BoardTitle } from './board-title';
import { FileControls } from './file-controls';
import type { Appearance } from './use-appearance';

type Props = {
  rename: (title: string) => Promise<LibraryEntry | null>;
  onShowShortcuts: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The chrome's appearance, applied by the shell so it follows the system on boot. */
  appearance: Appearance;
  onAppearanceChange: (next: Appearance) => void;
  /** A new number asks the menu to open and pick a board file at once. */
  importSignal: number;
};

/**
 * The board menu: the one place the title, the file actions, the chrome's
 * appearance and the board's own theme live now that the canvas has no title
 * bar. It floats under the hamburger and closes on Escape or an outside press.
 */
export const EditorMenu = ({
  rename,
  onShowShortcuts,
  open,
  onOpenChange,
  appearance,
  onAppearanceChange,
  importSignal,
}: Props) => {
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocus.current = document.activeElement;

    const onPointerDown = (event: PointerEvent) => {
      const element = root.current;
      if (element !== null && !element.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      const before = previousFocus.current;
      if (before instanceof HTMLElement && before.isConnected) {
        before.focus();
      }
    };
  }, [onOpenChange, open]);

  useEffect(() => {
    if (importSignal === 0) {
      return;
    }
    onOpenChange(true);
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>('[data-testid="file-input"]')
        ?.click();
    });

    return () => cancelAnimationFrame(frame);
  }, [importSignal, onOpenChange]);

  const toggle = useCallback(() => onOpenChange(!open), [onOpenChange, open]);
  const shortcuts = useCallback(() => {
    onOpenChange(false);
    onShowShortcuts();
  }, [onOpenChange, onShowShortcuts]);

  return (
    <div className='relative' ref={root}>
      <Button
        aria-expanded={open}
        aria-haspopup='dialog'
        aria-label='Menu'
        className='chrome-surface chrome-icon chrome-fg h-8 w-10 hover:bg-[var(--chrome-hover)]'
        data-testid='menu'
        onClick={toggle}
        size='icon'
        title='Menu'
        variant='ghost'
      >
        <IconMenu2 />
      </Button>
      {open ? (
        <div
          aria-label='Board menu'
          className='chrome-surface chrome-card absolute top-10 left-0 z-50 flex max-h-[calc(100svh-5rem)] w-80 flex-col gap-2 overflow-y-auto p-2'
          data-testid='menu-panel'
          role='dialog'
        >
          <div className='flex flex-col gap-1'>
            <span className='px-2 pt-1 font-medium text-muted-foreground text-xs'>
              Board
            </span>
            <BoardTitle rename={rename} />
          </div>
          <div className='h-px bg-border' />
          <FileControls />
          <div className='h-px bg-border' />
          <section className='flex flex-col gap-1 px-2 py-1'>
            <span className='font-medium text-muted-foreground text-xs'>
              Appearance
            </span>
            <AppearanceControl
              appearance={appearance}
              setAppearance={onAppearanceChange}
            />
          </section>
          <BoardTheme />
          <div className='h-px bg-border' />
          <Button
            className='w-full justify-start gap-2'
            onClick={shortcuts}
            size='sm'
            variant='ghost'
          >
            <IconHelpCircle />
            Keyboard shortcuts
          </Button>
          <Link
            className='flex h-7 w-full items-center gap-2 rounded-[8px] px-2.5 font-medium text-sm hover:bg-muted'
            data-testid='all-boards'
            href='/'
          >
            <IconLayoutGrid />
            All boards
          </Link>
        </div>
      ) : null}
    </div>
  );
};
