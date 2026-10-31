'use client';

import type { LibraryEntry } from '@kiyora/editor';
import Link from 'next/link';
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import { BoardPreview } from './board-preview';

export type BoardRowProps = {
  entry: LibraryEntry;
  /** Commits a new name. Rejects when the library could not write it. */
  onRename: (id: string, title: string) => Promise<void>;
  onDuplicate: (id: string) => void;
  onDelete: (entry: LibraryEntry) => void;
};

const nameOf = (entry: LibraryEntry): string => entry.title || 'Untitled';

const changedAt = (updatedAt: number): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(updatedAt);

/**
 * One board in the list: its name and last change, and the actions that change
 * it. Rename happens in place — Enter commits, Escape puts the old name back —
 * so a name is changed without a second screen. The actions are buttons, so
 * every one of them is reachable and runnable from the keyboard.
 */
export const BoardRow = ({
  entry,
  onRename,
  onDuplicate,
  onDelete,
}: BoardRowProps) => {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(entry.title);
  const settled = useRef<boolean>(false);
  const name = nameOf(entry);

  const start = (): void => {
    settled.current = false;
    setDraft(entry.title);
    setRenaming(true);
  };

  const commit = (): void => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    setRenaming(false);
    const next = draft.trim();
    if (next === '' || next === entry.title) {
      setDraft(entry.title);
      return;
    }
    onRename(entry.id, next).catch(() => setDraft(entry.title));
  };

  const cancel = (): void => {
    settled.current = true;
    setDraft(entry.title);
    setRenaming(false);
  };

  const duplicate = (): void => {
    onDuplicate(entry.id);
  };

  const remove = (): void => {
    onDelete(entry);
  };

  const change = (event: ChangeEvent<HTMLInputElement>): void => {
    settled.current = false;
    setDraft(event.target.value);
  };

  const focus = (event: FocusEvent<HTMLInputElement>): void => {
    settled.current = false;
    event.currentTarget.select();
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <li
      className='flex items-center gap-1 pr-2'
      data-board-id={entry.id}
      data-testid='library-row'
    >
      {renaming ? (
        <input
          aria-label={`Rename ${name}`}
          autoFocus
          className='mx-2 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 font-medium text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
          data-testid='rename-input'
          onBlur={commit}
          onChange={change}
          onFocus={focus}
          onKeyDown={keyDown}
          value={draft}
        />
      ) : (
        <Link
          className='flex min-w-0 flex-1 items-center gap-4 px-4 py-3 hover:bg-muted'
          data-board-id={entry.id}
          data-testid='library-board'
          href={`/b/${entry.id}`}
        >
          <BoardPreview svg={entry.preview} />
          <span className='flex min-w-0 flex-1 items-baseline justify-between gap-4'>
            <span className='truncate font-medium'>{name}</span>
            <time
              className='shrink-0 text-muted-foreground text-xs'
              dateTime={new Date(entry.updatedAt).toISOString()}
            >
              {changedAt(entry.updatedAt)}
            </time>
          </span>
        </Link>
      )}
      <div className='flex shrink-0 items-center gap-1'>
        <Button
          aria-label={`Rename ${name}`}
          data-testid='rename-board'
          onClick={start}
          size='sm'
          variant='ghost'
        >
          Rename
        </Button>
        <Button
          aria-label={`Duplicate ${name}`}
          data-testid='duplicate-board'
          onClick={duplicate}
          size='sm'
          variant='ghost'
        >
          Duplicate
        </Button>
        <Button
          aria-label={`Delete ${name}`}
          data-testid='delete-board'
          onClick={remove}
          size='sm'
          variant='ghost'
        >
          Delete
        </Button>
      </div>
    </li>
  );
};
