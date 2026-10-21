'use client';

import {
  type CommandHost,
  type ContextMenuItem,
  commandId,
  contextMenu,
  runCommand,
} from '@kiyora/editor';
import { useBoard, useEditor, useSelection } from '@kiyora/editor/react';
import { type KeyboardEvent, useCallback, useEffect, useRef } from 'react';
import { ContextMenuEntry } from './context-menu-item';

type Props = {
  /** Where the pointer opened it, in the canvas's own pixels. */
  at: { x: number; y: number };
  /** The app's side of the dispatch, for the commands the engine cannot finish alone. */
  host: CommandHost;
  onClose: () => void;
};

/** The entries a keyboard may land on, in reading order, so a disabled one is skipped. */
const enabledItems = (root: HTMLElement | null): HTMLElement[] =>
  root === null
    ? []
    : Array.from(
        root.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')
      );

/**
 * The selection's context menu. Every entry is a command handed to the one
 * dispatch, so the menu runs what the keyboard runs; a command without a valid
 * target is disabled rather than dropped, so the menu always says what the
 * selection can and cannot do. The menu is display state: it reads the board and
 * the selection, writes nothing, and is gone the moment it is dismissed.
 *
 * Focus moves to the first enabled entry on open and returns where it was when
 * the menu closes. The arrows, Home and End walk the enabled entries, Enter and
 * Space run the focused one, and Escape or a pointer outside dismisses it.
 */
export const ContextMenu = ({ at, host, onClose }: Props) => {
  const editor = useEditor();
  const board = useBoard();
  const selection = useSelection();
  const root = useRef<HTMLDivElement>(null);
  const sections = contextMenu({
    board,
    canPaste: editor.canPaste(),
    selection,
  });

  useEffect(() => {
    const before = document.activeElement;
    enabledItems(root.current)[0]?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (
        root.current !== null &&
        event.target instanceof Node &&
        !root.current.contains(event.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      if (before instanceof HTMLElement && before.isConnected) {
        before.focus();
      }
    };
  }, [onClose]);

  const choose = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) {
        return;
      }
      onClose();
      runCommand(item.command, { editor, host });
    },
    [editor, host, onClose]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const items = enabledItems(root.current);
      if (items.length === 0) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const current = document.activeElement;
        const index =
          current instanceof HTMLElement ? items.indexOf(current) : -1;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        items[(index + step + items.length) % items.length]?.focus();
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        event.stopPropagation();
        items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.stopPropagation();
      }
    },
    [onClose]
  );

  return (
    <div
      aria-label='Selection menu'
      className='absolute z-30 max-h-96 w-60 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-md'
      data-testid='context-menu'
      onKeyDown={onKeyDown}
      ref={root}
      role='menu'
      style={{ left: at.x, top: at.y }}
    >
      {sections.map((section) => (
        <div key={section.label} role='presentation'>
          <p
            className='px-2 py-1 text-muted-foreground text-xs uppercase tracking-wide'
            role='presentation'
          >
            {section.label}
          </p>
          {section.items.map((item) => (
            <ContextMenuEntry
              item={item}
              key={commandId(item.command)}
              onChoose={choose}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
