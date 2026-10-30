'use client';

import {
  createLibrary,
  type LibraryEntry,
  type StorageFault,
} from '@kiyora/editor';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountControl } from '~/components/auth/account-control';
import { Button } from '~/components/ui/button';
import type { AccountSummary } from '~/lib/auth/account';
import { openStore } from '~/lib/board-storage';
import { newBoard } from '~/lib/new-board';

/** The fault a library carries when its storage would not open. */
const faultMessage = (fault: StorageFault): string => {
  switch (fault.kind) {
    case 'quota':
      return 'Storage is full — free some space to keep your boards';
    case 'blocked':
      return 'Storage is blocked — allow site data to see your boards';
    default:
      return 'Storage is unavailable — this browser cannot keep boards';
  }
};

const changedAt = (updatedAt: number): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(updatedAt);

type Props = {
  account: AccountSummary | null;
};

/**
 * Every board this browser holds, newest change first. A row names the board and
 * when it last changed, and opens that board's own address. New board writes an
 * empty board at a fresh id and goes to it, so the list never has to guess which
 * board a person meant.
 */
export const Library = ({ account }: Props) => {
  const router = useRouter();
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [fault, setFault] = useState<StorageFault | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { fault: openFault, store } = await openStore();
      const library = createLibrary(store);
      const listed = await library.entries();
      if (!cancelled) {
        setEntries(listed);
        setFault(openFault);
      }
    })().catch(() => {
      if (!cancelled) {
        setEntries([]);
        setFault({ kind: 'unavailable' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const create = async (): Promise<void> => {
    setCreating(true);
    try {
      const { store } = await openStore();
      const board = newBoard();
      await createLibrary(store).create(board);
      router.push(`/b/${board.id}`);
    } catch {
      setFault({ kind: 'unavailable' });
      setCreating(false);
    }
  };

  const start = (): void => {
    create().catch(() => undefined);
  };

  return (
    <main className='mx-auto flex h-svh w-full max-w-3xl flex-col gap-6 p-6'>
      <header className='flex items-center justify-between gap-4'>
        <h1 className='font-semibold text-xl'>Boards</h1>
        <div className='flex items-center gap-4'>
          <AccountControl account={account} />
          <Button data-testid='new-board' disabled={creating} onClick={start}>
            New board
          </Button>
        </div>
      </header>
      {fault === null ? null : (
        <p className='text-destructive text-sm' role='alert'>
          {faultMessage(fault)}
        </p>
      )}
      <div data-testid='library'>
        {entries === null ? (
          <p className='text-muted-foreground text-sm'>Opening the library…</p>
        ) : entries.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No boards yet — create one to start drawing.
          </p>
        ) : (
          <ul className='divide-y divide-border rounded-lg border border-border'>
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  className='flex items-baseline justify-between gap-4 px-4 py-3 hover:bg-muted'
                  data-board-id={entry.id}
                  data-testid='library-board'
                  href={`/b/${entry.id}`}
                >
                  <span className='truncate font-medium'>
                    {entry.title || 'Untitled'}
                  </span>
                  <time
                    className='shrink-0 text-muted-foreground text-xs'
                    dateTime={new Date(entry.updatedAt).toISOString()}
                  >
                    {changedAt(entry.updatedAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};
