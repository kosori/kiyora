'use client';

import type { RemoteBoardSummary } from '@kiyora/sync';
import { useCallback, useEffect, useState } from 'react';
import { listRemoteBoards } from '~/lib/remote-board';
import { BoardPreview } from './board-preview';
import { changedAt } from './changed-at';

type Opening = 'loading' | 'ready' | 'unavailable';

type RowProps = {
  board: RemoteBoardSummary;
  disabled: boolean;
  onOpen: (summary: RemoteBoardSummary) => Promise<void>;
};

/** One remote copy in the section: its title, last change and picture. */
const RemoteBoardRow = ({ board, disabled, onOpen }: RowProps) => {
  const open = useCallback(() => {
    onOpen(board).catch(() => undefined);
  }, [board, onOpen]);

  return (
    <li>
      <button
        className='flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted disabled:opacity-60'
        data-board-id={board.id}
        data-testid='remote-board'
        disabled={disabled}
        onClick={open}
        type='button'
      >
        <BoardPreview svg={board.preview ?? undefined} />
        <span className='flex min-w-0 flex-1 items-baseline justify-between gap-4'>
          <span className='truncate font-medium'>
            {board.title || 'Untitled'}
          </span>
          <time
            className='shrink-0 text-muted-foreground text-xs'
            dateTime={board.updatedAt}
          >
            {changedAt(Date.parse(board.updatedAt))}
          </time>
        </span>
      </button>
    </li>
  );
};

type Props = {
  /** The ids this browser already holds, which this section leaves out. */
  held: string[];
  /** Downloads and stores one remote copy. False when it is gone remotely. */
  onOpen: (summary: RemoteBoardSummary) => Promise<boolean>;
};

/**
 * The remote copies this account holds that this browser does not. The list is
 * read when the library opens and never carries a payload: only opening a board
 * downloads its bytes. A failed listing says so and leaves the local library
 * untouched, because the local copy is still the only one that must work.
 */
export const RemoteBoards = ({ held, onOpen }: Props) => {
  const [state, setState] = useState<Opening>('loading');
  const [boards, setBoards] = useState<RemoteBoardSummary[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listRemoteBoards()
      .then((listed) => {
        if (!cancelled) {
          setBoards(listed);
          setState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('unavailable');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const open = useCallback(
    async (summary: RemoteBoardSummary): Promise<void> => {
      setOpening(summary.id);
      setError(null);
      try {
        const stored = await onOpen(summary);
        if (!stored) {
          setBoards((current) =>
            current.filter((board) => board.id !== summary.id)
          );
        }
      } catch {
        setError(
          'That board could not be downloaded — this browser still has its own.'
        );
      } finally {
        setOpening(null);
      }
    },
    [onOpen]
  );

  const shown = boards.filter((board) => !held.includes(board.id));

  return (
    <section
      aria-labelledby='remote-boards-heading'
      className='flex flex-col gap-2'
      data-state={state}
      data-testid='remote-boards'
    >
      <h2 className='font-medium text-sm' id='remote-boards-heading'>
        Your boards
      </h2>
      {state === 'loading' ? (
        <p className='text-muted-foreground text-sm'>
          Looking for your boards…
        </p>
      ) : null}
      {state === 'unavailable' ? (
        <p
          className='text-destructive text-sm'
          data-testid='remote-boards-unavailable'
          role='alert'
        >
          Your boards are unavailable — this browser still has its own.
        </p>
      ) : null}
      {state === 'ready' && shown.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          Every board in this account is already in this browser.
        </p>
      ) : null}
      {state === 'ready' && shown.length > 0 ? (
        <ul className='divide-y divide-border rounded-lg border border-border'>
          {shown.map((board) => (
            <RemoteBoardRow
              board={board}
              disabled={opening !== null}
              key={board.id}
              onOpen={open}
            />
          ))}
        </ul>
      ) : null}
      {error === null ? null : (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      )}
    </section>
  );
};
