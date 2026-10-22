'use client';

import {
  type CommandHost,
  commandPalette,
  type PaletteEntry,
  runCommand,
} from '@kiyora/editor';
import { useEditor } from '@kiyora/editor/react';
import {
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SCROLLABLE } from './overlay-fit';

type Props = {
  host: CommandHost;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const LIST_ID = 'command-palette-list';

/** The id of one option, so the search box can name the active one without moving focus. */
const optionId = (index: number): string => `command-palette-option-${index}`;

/**
 * The command palette: the shortcut reference's rows, searchable, each one run
 * through the one dispatch. The list is generated from the same rows as the
 * reference, so the dialog and the palette cannot show different commands. A
 * command that needs a selection simply finds none: the dispatch does nothing
 * rather than a disabled row hiding half the list.
 *
 * The palette is a native modal dialog, so Escape, the backdrop and focus
 * return are the browser's, and the app's key listener already ignores a key
 * pressed inside the search box. Focus stays in the search box and the active
 * option is named by `aria-activedescendant`, so the arrows move the list
 * rather than the caret.
 *
 * The dialog is bounded by the viewport: in a short window the list shrinks and
 * scrolls with a visible bar while the search box stays on screen.
 */
export const CommandPalette = ({ host, onOpenChange, open }: Props) => {
  const editor = useEditor();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const entries = useMemo(() => commandPalette(), []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return needle === ''
      ? entries
      : entries.filter((entry) => entry.label.toLowerCase().includes(needle));
  }, [entries, query]);

  const current = Math.min(active, Math.max(shown.length - 1, 0));

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
      setQuery('');
      setActive(0);
      input.current?.focus();
      return;
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document
        .getElementById(optionId(current))
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [current, open]);

  const choose = useCallback(
    (entry: PaletteEntry) => {
      const [command] = entry.commands;
      if (command === undefined) {
        return;
      }
      dialog.current?.close();
      runCommand(command, { editor, host });
    },
    [editor, host]
  );

  /** A click on the backdrop dismisses; a click on a row runs the command it names. */
  const onDialogClick = useCallback(
    (event: ReactMouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) {
        dialog.current?.close();
        return;
      }
      if (!(event.target instanceof Element)) {
        return;
      }
      const row = event.target.closest('[data-palette-index]');
      const index = Number(row?.getAttribute('data-palette-index'));
      const entry = shown[index];
      if (row !== null && entry !== undefined) {
        choose(entry);
      }
    },
    [choose, shown]
  );

  /** The arrows and Enter work from the search box, whose keys bubble to the dialog. */
  const onDialogKey = useCallback(
    (event: ReactKeyboardEvent<HTMLDialogElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const entry = shown[current];
        if (entry !== undefined) {
          choose(entry);
        }
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }
      event.preventDefault();
      setActive((index) => {
        if (shown.length === 0) {
          return 0;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;

        return (index + step + shown.length) % shown.length;
      });
    },
    [choose, current, shown]
  );

  const onQuery = useCallback((event: ReactChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setActive(0);
  }, []);

  return (
    <dialog
      aria-label='Command palette'
      className='m-auto w-[min(32rem,90vw)] overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/20 open:flex open:max-h-[min(36rem,85vh)] open:flex-col'
      data-testid='command-palette'
      onClick={onDialogClick}
      onClose={close}
      onKeyDown={onDialogKey}
      ref={dialog}
    >
      <div className='shrink-0 border-border border-b p-2'>
        <input
          aria-activedescendant={
            shown.length === 0 ? undefined : optionId(current)
          }
          aria-autocomplete='list'
          aria-controls={LIST_ID}
          aria-expanded={true}
          aria-label='Search commands'
          autoComplete='off'
          className='w-full bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground'
          onChange={onQuery}
          placeholder='Type a command'
          ref={input}
          role='combobox'
          spellCheck={false}
          type='text'
          value={query}
        />
      </div>
      {shown.length === 0 ? (
        <p className='px-3 py-2 text-muted-foreground text-sm'>
          No command matches
        </p>
      ) : (
        <div
          aria-label='Commands'
          className={`min-h-0 flex-1 p-1 ${SCROLLABLE}`}
          id={LIST_ID}
          role='listbox'
        >
          {shown.map((entry, index) => (
            <div
              aria-selected={index === current}
              className={`flex cursor-pointer items-center gap-4 rounded px-3 py-1.5 text-sm ${
                index === current ? 'bg-muted' : ''
              }`}
              data-palette-index={index}
              id={optionId(index)}
              key={`${entry.group}.${entry.label}`}
              role='option'
              tabIndex={-1}
            >
              <span className='flex-1' data-testid='palette-label'>
                {entry.label}
              </span>
              <span className='flex gap-1'>
                {entry.keys.map((key) => (
                  <kbd
                    className='rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs'
                    key={key}
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </dialog>
  );
};
