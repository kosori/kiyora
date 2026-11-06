'use client';

import type { StorageFault } from '@kiyora/editor';
import type { RemoteBoardSummary } from '@kiyora/sync';
import { useCallback, useEffect, useState } from 'react';
import { listRemoteBoards, type RemoteBoardOpen } from '~/lib/remote-board';
import { BoardPreview } from './board-preview';
import { changedAt } from './changed-at';

const PAGE_SIZE = 50;

type Listing =
  | { status: 'loading' }
  | { status: 'ready'; boards: RemoteBoardSummary[]; total: number }
  | { status: 'unauthorized' }
  | { status: 'server' }
  | { status: 'network' };

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

/** Why a listing failed, kept distinct from a correct empty account. */
const listingNote = (status: 'unauthorized' | 'server' | 'network'): string => {
  switch (status) {
    case 'unauthorized':
      return 'Sign in again to see your boards — this browser still has its own.';
    case 'server':
      return 'Your boards could not be read — the server did not answer. This browser still has its own.';
    default:
      return 'Your boards are unavailable — this browser still has its own.';
  }
};

/** Why one download failed, in the same words the exchange distinguished. */
const openNote = (reason: 'network' | 'server' | 'unauthorized'): string => {
  switch (reason) {
    case 'unauthorized':
      return 'Sign in again to download that board.';
    case 'server':
      return 'The server could not open that board — try again.';
    default:
      return 'That board could not be downloaded — check your connection.';
  }
};

/** Why the downloaded board could not be stored. */
const faultNote = (fault: StorageFault): string => {
  switch (fault.kind) {
    case 'quota':
      return 'This browser is out of space — free some space to download that board.';
    case 'blocked':
      return 'This browser blocks storage — allow site data to download that board.';
    default:
      return 'This browser could not keep the downloaded board.';
  }
};

type Props = {
  /** The ids this browser already holds, which this section leaves out. */
  held: string[];
  /** Downloads and stores one remote copy, naming every outcome. */
  onOpen: (summary: RemoteBoardSummary) => Promise<RemoteBoardOpen>;
};

/**
 * The remote copies this account holds that this browser does not. The first
 * page is read when the library opens and later pages only when asked; no
 * listing carries a payload, so only opening a board downloads its bytes. A
 * failed listing says which failure it was and leaves the local library
 * untouched, because the local copy is still the only one that must work.
 */
export const RemoteBoards = ({ held, onOpen }: Props) => {
  const [listing, setListing] = useState<Listing>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listRemoteBoards().then((result) => {
      if (cancelled) {
        return;
      }
      setListing(
        result.status === 'ok'
          ? { boards: result.boards, status: 'ready', total: result.total }
          : { status: result.status }
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async (): Promise<void> => {
    if (listing.status !== 'ready') {
      return;
    }

    setLoadingMore(true);
    setError(null);

    const result = await listRemoteBoards({
      limit: PAGE_SIZE,
      offset: listing.boards.length,
    });

    setLoadingMore(false);

    if (result.status !== 'ok') {
      setError(listingNote(result.status));
      return;
    }

    setListing((current) => {
      if (current.status !== 'ready') {
        return current;
      }
      const seen = new Set(current.boards.map((board) => board.id));
      return {
        boards: current.boards.concat(
          result.boards.filter((board) => !seen.has(board.id))
        ),
        status: 'ready',
        total: result.total,
      };
    });
  }, [listing]);

  const hide = useCallback((id: string, gone: boolean): void => {
    setHidden((current) => (current.includes(id) ? current : [...current, id]));

    if (!gone) {
      return;
    }

    setListing((current) =>
      current.status === 'ready'
        ? { ...current, total: Math.max(0, current.total - 1) }
        : current
    );
  }, []);

  const open = useCallback(
    async (summary: RemoteBoardSummary): Promise<void> => {
      setOpening(summary.id);
      setError(null);

      let outcome: RemoteBoardOpen;

      try {
        outcome = await onOpen(summary);
      } catch {
        setError('This browser could not finish the download — try again.');
        setOpening(null);
        return;
      }

      switch (outcome.status) {
        case 'opened':
          break;
        case 'gone':
          hide(summary.id, true);
          setError('That board is no longer on the server.');
          break;
        case 'held':
          hide(summary.id, false);
          setError('That board is already in this browser.');
          break;
        case 'unavailable':
          setError(openNote(outcome.reason));
          break;
        case 'fault':
          setError(faultNote(outcome.fault));
          break;
        default:
          break;
      }

      setOpening(null);
    },
    [hide, onOpen]
  );

  const showMore = useCallback((): void => {
    loadMore().catch(() => undefined);
  }, [loadMore]);

  const shown =
    listing.status === 'ready'
      ? listing.boards.filter(
          (board) => !(held.includes(board.id) || hidden.includes(board.id))
        )
      : [];
  const more =
    listing.status === 'ready' && listing.boards.length < listing.total;
  const state: Opening =
    listing.status === 'ready'
      ? 'ready'
      : listing.status === 'loading'
        ? 'loading'
        : 'unavailable';

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
      {listing.status === 'ready' || listing.status === 'loading' ? null : (
        <p
          className='text-destructive text-sm'
          data-testid='remote-boards-unavailable'
          role='alert'
        >
          {listingNote(listing.status)}
        </p>
      )}
      {listing.status === 'ready' && shown.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {listing.total === 0
            ? 'This account has no boards yet.'
            : more
              ? 'No boards this browser is missing on this page.'
              : 'Every board in this account is already in this browser.'}
        </p>
      ) : null}
      {shown.length > 0 ? (
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
      {more ? (
        <button
          className='self-start text-sm underline underline-offset-4 disabled:opacity-60'
          data-testid='remote-boards-more'
          disabled={loadingMore || opening !== null}
          onClick={showMore}
          type='button'
        >
          {loadingMore ? 'Loading more…' : 'Load more'}
        </button>
      ) : null}
      {error === null ? null : (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      )}
    </section>
  );
};
