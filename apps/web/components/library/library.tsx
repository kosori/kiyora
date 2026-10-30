'use client';

import {
  createLibrary,
  type LibraryEntry,
  type Library as LibraryStore,
  type StorageFault,
} from '@kiyora/editor';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { openStore } from '~/lib/board-storage';
import { newBoard } from '~/lib/new-board';
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
export const Library = () => {
  const router = useRouter();
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [fault, setFault] = useState<StorageFault | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null);

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

  const remove = (entry: LibraryEntry): void => {
    setDeleting(null);
    act((library) => library.remove(entry.id)).catch(() => undefined);
  };

  const renameBoard = (id: string, title: string): Promise<void> =>
    act((library) => library.rename(id, title));

  const duplicateBoard = (id: string): void => {
    act((library) => library.duplicate(id)).catch(() => undefined);
  };

  const askDelete = (entry: LibraryEntry): void => {
    setDeleting(entry);
  };

  const answerDelete = (open: boolean): void => {
    if (!open) {
      setDeleting(null);
    }
  };

  const confirmDelete = (): void => {
    if (deleting !== null) {
      remove(deleting);
    }
  };

  return (
    <main className='mx-auto flex h-svh w-full max-w-3xl flex-col gap-6 p-6'>
      <header className='flex items-center justify-between gap-4'>
        <h1 className='font-semibold text-xl'>Boards</h1>
        <Button data-testid='new-board' disabled={creating} onClick={start}>
          New board
        </Button>
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
        onConfirm={confirmDelete}
        onOpenChange={answerDelete}
        open={deleting !== null}
        title={deleting?.title ?? ''}
      />
    </main>
  );
};
