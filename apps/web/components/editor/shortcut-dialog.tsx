'use client';

import {
  GESTURE_REFERENCE,
  type ReferenceRow,
  shortcutReference,
} from '@kiyora/editor';
import { useCallback, useEffect, useRef } from 'react';

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * The reference's rows, in sections, in the order the keymap declares them. The
 * pointer gestures' modifiers follow the keymap's rows, so the dialog teaches
 * what alt and shift do to a drag as well as to a key.
 */
const groupRows = (): Map<string, ReferenceRow[]> => {
  const groups = new Map<string, ReferenceRow[]>();

  for (const row of [...shortcutReference(), ...GESTURE_REFERENCE]) {
    const rows = groups.get(row.group) ?? [];
    rows.push(row);
    groups.set(row.group, rows);
  }

  return groups;
};

/**
 * The keyboard shortcut reference. Every row is generated from the keymap, so
 * the sheet can only ever show a key the app actually runs.
 */
export const ShortcutDialog = ({ onOpenChange, open }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
      return;
    }
    if (!open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      aria-label='Keyboard shortcuts'
      className='m-auto max-h-[85vh] max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-6 text-foreground outline-none backdrop:bg-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50'
      onClose={close}
      ref={dialog}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable dialog must be reachable by keyboard, which is what axe's scrollable-region-focusable asks for
      tabIndex={0}
    >
      <h2 className='mb-4 font-heading font-semibold text-lg'>
        Keyboard shortcuts
      </h2>
      {[...groupRows()].map(([group, rows]) => (
        <section key={group}>
          <h3 className='mb-2 font-medium text-muted-foreground text-xs uppercase'>
            {group}
          </h3>
          <ul className='mb-4 flex flex-col gap-2'>
            {rows.map((row) => (
              <li className='flex items-center gap-8' key={row.label}>
                <span className='flex-1'>{row.label}</span>
                <span className='flex gap-1'>
                  {row.keys.map((key) => (
                    <kbd
                      className='rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs'
                      key={key}
                    >
                      {key.toUpperCase()}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </dialog>
  );
};
