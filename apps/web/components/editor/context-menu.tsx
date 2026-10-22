'use client';

import {
  type CommandHost,
  commandId,
  contextMenu,
  type ContextMenuItem as MenuItem,
  runCommand,
} from '@kiyora/editor';
import { useBoard, useEditor, useSelection } from '@kiyora/editor/react';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ContextMenuItem } from './context-menu-item';
import { SCROLLABLE } from './overlay-fit';

/** The menu's width, which `w-60` must match: the clamp and the class are one size. */
const WIDTH = 240;

/** The gap kept between the menu and every canvas edge. */
const GAP = 8;

/** Taller than this the menu scrolls, however tall the window is. */
const MAX_HEIGHT = 512;

/** Where the menu sits, in the canvas's own pixels. */
type Placement = {
  left: number;
  maxHeight: number;
  top: number;
};

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

/** Focuses one entry and brings it into view, so a menu that scrolls still walks from the keys. */
const focusItem = (item: HTMLElement | undefined): void => {
  if (item === undefined) {
    return;
  }
  item.focus({ preventScroll: true });
  item.scrollIntoView({ block: 'nearest' });
};

/**
 * Where the menu fits: it opens downward while the content fits below the
 * pointer, upward when the room above is the larger side, and is never taller
 * than the room on the side it opens to. Horizontally it stays between the
 * canvas edges, which is where the right rail begins.
 */
const place = (
  surface: HTMLElement,
  at: { x: number; y: number },
  contentHeight: number
): Placement => {
  const above = Math.max(0, at.y - GAP);
  const below = Math.max(0, surface.clientHeight - at.y - GAP);
  const openUp = contentHeight > below && above > below;
  const room = openUp ? above : below;
  const maxHeight = Math.min(MAX_HEIGHT, room);
  const height = Math.min(contentHeight, maxHeight);
  const top = openUp ? at.y - height : at.y;
  const left = Math.max(GAP, Math.min(at.x, surface.clientWidth - WIDTH - GAP));

  return {
    left,
    maxHeight,
    top: Math.max(0, Math.min(top, surface.clientHeight - height)),
  };
};

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
 *
 * The menu is sized to the room between the pointer and the canvas edge, opens
 * upward when that side has more room, and scrolls with a visible bar when the
 * entries are taller than any side allows.
 */
export const ContextMenu = ({ at, host, onClose }: Props) => {
  const editor = useEditor();
  const board = useBoard();
  const selection = useSelection();
  const root = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const sections = contextMenu({
    board,
    canPaste: editor.canPaste(),
    selection,
  });

  useLayoutEffect(() => {
    const element = root.current;
    const surface = element?.parentElement;
    if (element === null || surface === null || surface === undefined) {
      return;
    }
    setPlacement(place(surface, at, element.scrollHeight));
  }, [at]);

  useEffect(() => {
    const before = document.activeElement;
    focusItem(enabledItems(root.current)[0]);

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
    (item: MenuItem) => {
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
        focusItem(items[(index + step + items.length) % items.length]);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        event.stopPropagation();
        focusItem(items[event.key === 'Home' ? 0 : items.length - 1]);
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
      className={`absolute z-30 w-60 rounded-lg border border-border bg-background p-1 shadow-md ${SCROLLABLE}`}
      data-testid='context-menu'
      onKeyDown={onKeyDown}
      ref={root}
      role='menu'
      style={{
        left: placement?.left ?? at.x,
        maxHeight: placement?.maxHeight,
        top: placement?.top ?? at.y,
      }}
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
            <ContextMenuItem
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
