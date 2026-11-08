'use client';

import { keyshortcutsFor, type Platform, type Tool } from '@kiyora/editor';
import { useEditor, useTool } from '@kiyora/editor/react';
import {
  IconHighlight,
  IconLayoutGridAdd,
  type TablerIcon,
} from '@tabler/icons-react';
import { cn } from 'cn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { usePlatform } from './use-platform';

type MoreEntry = {
  icon: TablerIcon;
  label: string;
  tool: Tool;
};

/** The tools demoted from the rail into its More menu. */
const MORE: readonly MoreEntry[] = [
  { icon: IconHighlight, label: 'Highlighter', tool: 'highlighter' },
];

type MoreItemProps = {
  entry: MoreEntry;
  onChoose: (entry: MoreEntry) => void;
  platform: Platform;
  selected: boolean;
};

/** One demoted tool in the More menu. */
const MoreItem = ({ entry, onChoose, platform, selected }: MoreItemProps) => {
  const { icon: Icon, label, tool } = entry;
  const choose = useCallback(() => onChoose(entry), [entry, onChoose]);

  return (
    <Button
      aria-keyshortcuts={keyshortcutsFor({ kind: 'tool', tool }, platform)}
      className='chrome-hover h-8 w-full justify-start gap-2 rounded-[8px] px-2 text-[13px]'
      data-testid={`rail-more-${tool}`}
      onClick={choose}
      role='menuitem'
      size='default'
      style={selected ? { backgroundColor: 'var(--chrome-active)' } : undefined}
      variant='ghost'
    >
      <Icon />
      {label}
    </Button>
  );
};

/** The demoted tools, behind one rail entry, so the rail stays one narrow card. */
export const RailMore = () => {
  const editor = useEditor();
  const platform = usePlatform();
  const tool = useTool();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const active = MORE.some((entry) => entry.tool === tool);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocus.current = document.activeElement;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const element = root.current;
      if (element !== null && !element.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
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
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  const choose = useCallback(
    (entry: MoreEntry) => {
      editor.setTool(entry.tool);
      setOpen(false);
    },
    [editor]
  );

  return (
    <div className='relative' ref={root}>
      <Button
        aria-expanded={open}
        aria-haspopup='menu'
        aria-label='More'
        aria-pressed={active}
        className={cn(
          'chrome-icon chrome-fg [&_svg]:size-[18px] [&_svg]:[stroke-width:1.75]',
          active
            ? 'hover:bg-[var(--chrome-active)]'
            : 'chrome-hover hover:bg-[var(--chrome-hover)]'
        )}
        data-testid='rail-more'
        onClick={toggle}
        size='icon'
        style={active ? { backgroundColor: 'var(--chrome-active)' } : undefined}
        title='More'
        variant='ghost'
      >
        <IconLayoutGridAdd />
      </Button>
      <span
        aria-hidden='true'
        className='pointer-events-none absolute right-[3px] bottom-[3px] h-0 w-0 border-r-[4px] border-r-transparent border-b-[4px] border-b-[var(--chrome-muted)]'
      />
      {open ? (
        <div
          className='chrome-surface absolute top-0 left-full z-20 ml-1 w-52 rounded-[12px] p-1'
          data-testid='rail-more-menu'
          ref={menu}
          role='menu'
        >
          {MORE.map((entry) => (
            <MoreItem
              entry={entry}
              key={entry.tool}
              onChoose={choose}
              platform={platform}
              selected={entry.tool === tool}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
