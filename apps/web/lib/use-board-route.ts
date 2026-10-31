'use client';

import {
  type BoardStorage,
  boardKey,
  createLibrary,
  type LibraryEntry,
  type StorageFault,
} from '@kiyora/editor';
import type { Board } from '@kiyora/model';
import type { SyncRecord } from '@kiyora/sync';
import { useEffect, useState } from 'react';
import { openStore } from './board-storage';
import { emptyBoard, UNTITLED } from './new-board';

/** What the board route shows: loading, not in this library, or one board. */
export type BoardRouteState =
  | { status: 'loading' }
  | { status: 'missing' }
  | {
      status: 'ready';
      board: Board;
      storage: BoardStorage;
      fault: StorageFault | null;
      migratedFrom: number | null;
      writable: boolean;
      rewrite: boolean;
      /** What the library record remembers about the remote copy. */
      sync: SyncRecord;
      /** Persists what the reconciler learned, beside the board's record. */
      recordSync: (record: SyncRecord) => void;
    };

/** The sync record a library entry carries, read without opening a payload. */
const syncOf = (entry: LibraryEntry | undefined): SyncRecord => ({
  conflict: entry?.conflict ?? null,
  linked: entry?.linked === true && typeof entry.revision === 'number',
  revision: entry?.revision ?? null,
  tooLarge: entry?.tooLarge === true,
});

/**
 * Opens one board by id. A board the library does not hold is reported as
 * missing, never created: only the library's New-board action makes a board.
 *
 * Bytes that will not read are quarantined and replaced by a fresh board under
 * the same id, the way the single board was rescued before the library. If they
 * could not be quarantined, the board is shown read-only rather than overwritten.
 * A migrated board is rewritten once, so its stored copy is the current schema.
 */
export const useBoardRoute = (boardId: string): BoardRouteState => {
  const [state, setState] = useState<BoardRouteState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { fault: openFault, store } = await openStore();
      const library = createLibrary(store);
      const entry = (await library.entries()).find(
        (board) => board.id === boardId
      );
      const stored = await store.get(boardKey(boardId));
      if (entry === undefined && stored === null) {
        if (!cancelled) {
          setState({ status: 'missing' });
        }
        return;
      }

      const sync = syncOf(entry);
      const recordSync = async (record: SyncRecord): Promise<void> => {
        try {
          await library.setSync(boardId, record);
        } catch {
          // The record is a cache: the next save writes it again.
        }
      };
      const loaded = await library.load(boardId);
      if (cancelled) {
        return;
      }

      const title = entry?.title || UNTITLED;
      if (loaded.status === 'loaded') {
        setState({
          board: loaded.board,
          fault: openFault,
          migratedFrom: loaded.migratedFrom,
          recordSync,
          rewrite: loaded.migratedFrom !== null,
          status: 'ready',
          storage: library.storage(boardId),
          sync,
          writable: true,
        });
        return;
      }

      if (loaded.status === 'empty') {
        setState({
          board: emptyBoard(boardId, Date.now(), title),
          fault: openFault,
          migratedFrom: null,
          recordSync,
          rewrite: true,
          status: 'ready',
          storage: library.storage(boardId),
          sync,
          writable: true,
        });
        return;
      }

      setState({
        board: emptyBoard(boardId, Date.now(), title),
        fault: loaded.fault,
        migratedFrom: null,
        recordSync,
        rewrite: loaded.quarantined,
        status: 'ready',
        storage: library.storage(boardId),
        sync,
        writable: loaded.quarantined,
      });
    })().catch(() => {
      if (!cancelled) {
        setState({ status: 'missing' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  return state;
};
