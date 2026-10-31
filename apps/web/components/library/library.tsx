'use client';

import {
  createLibrary,
  type LibraryEntry,
  type Library as LibraryStore,
  type StorageFault,
} from '@kiyora/editor';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AccountControl } from '~/components/auth/account-control';
import { BoardFileImport } from '~/components/board-file-import';
import { Button } from '~/components/ui/button';
import type { AccountSummary } from '~/lib/auth/account';
import { openStore } from '~/lib/board-storage';
import { newBoard } from '~/lib/new-board';
import { httpSyncTransport } from '~/lib/sync/transport';
import { BoardRow } from './board-row';
import { DeleteBoardDialog } from './delete-board-dialog';

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

/** Why a linked board's delete stopped before either copy was touched. */
const REMOTE_FAILED =
  'The remote copy could not be deleted. Nothing was removed — try again.';

/** The account a linked board's remote copy lives in, as the confirm names it. */
const accountName = (account: AccountSummary | null): string =>
  account === null ? 'your account' : account.name || account.email;

type Props = {
  account: AccountSummary | null;
};

/**
 * Every board this browser holds, newest change first. A row opens that board's
 * own address, renames it in place, duplicates it under a new address, or asks
 * before deleting it. New board writes an empty board at a fresh id and goes to
 * it, so the list never has to guess which board a person meant.
 *
 * Every action changes the library through one write funnel — the payload first
 * and the record after it — and then re-reads the list, so an action can never
 * show a row the stored boards do not hold.
 */
export const Library = ({ account }: Props) => {
  const router = useRouter();
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [fault, setFault] = useState<StorageFault | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const act = async (
    work: (library: LibraryStore) => Promise<unknown>
  ): Promise<void> => {
    try {
      const { store } = await openStore();
      const library = createLibrary(store);
      await work(library);
      setEntries(await library.entries());
    } catch {
      setFault({ kind: 'unavailable' });
    }
  };

  const reload = useCallback(async (): Promise<void> => {
    try {
      const { store } = await openStore();
      setEntries(await createLibrary(store).entries());
    } catch {
      setFault({ kind: 'unavailable' });
    }
  }, []);

  const imported = useCallback(() => {
    setError(null);
    reload().catch(() => undefined);
  }, [reload]);

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

  const remove = async (entry: LibraryEntry): Promise<void> => {
    setDeleteError(null);

    if (entry.linked) {
      const result = await httpSyncTransport.remove(entry.id);
      if (result.kind === 'failed') {
        setDeleteError(REMOTE_FAILED);
        return;
      }
    }

    await act((library) => library.remove(entry.id));
    setDeleting(null);
  };

  const renameBoard = (id: string, title: string): Promise<void> =>
    act((library) => library.rename(id, title));

  const duplicateBoard = (id: string): void => {
    act((library) => library.duplicate(id)).catch(() => undefined);
  };

  const askDelete = (entry: LibraryEntry): void => {
    setDeleteError(null);
    setDeleting(entry);
  };

  const answerDelete = (open: boolean): void => {
    if (!open) {
      setDeleteError(null);
      setDeleting(null);
    }
  };

  const confirmDelete = (): void => {
    if (deleting !== null) {
      remove(deleting).catch(() => setDeleteError(REMOTE_FAILED));
    }
  };

  return (
    <main className='mx-auto flex h-svh w-full max-w-3xl flex-col gap-6 p-6'>
      <header className='flex items-center justify-between gap-4'>
        <h1 className='font-semibold text-xl'>Boards</h1>
        <div className='flex items-center gap-4'>
          <AccountControl account={account} />
          <BoardFileImport
            buttonTestId='library-import-file'
            inputTestId='library-file-input'
            onFailed={setError}
            onImported={imported}
          />
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
      {error === null ? null : (
        <p
          className='text-destructive text-sm'
          data-testid='import-error'
          role='alert'
        >
          {error}
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
              <BoardRow
                entry={entry}
                key={entry.id}
                onDelete={askDelete}
                onDuplicate={duplicateBoard}
                onRename={renameBoard}
              />
            ))}
          </ul>
        )}
      </div>
      <DeleteBoardDialog
        body={
          deleting?.linked === true ? (
            <>
              Both copies are removed: the local copy in this browser, and the
              remote copy in {accountName(account)}. This cannot be undone.
            </>
          ) : undefined
        }
        error={deleteError}
        onConfirm={confirmDelete}
        onOpenChange={answerDelete}
        open={deleting !== null}
        title={deleting?.title ?? ''}
      />
    </main>
  );
};
