'use client';

import {
  type BoardStorage,
  boardKey,
  createLibrary,
  type StorageFault,
} from '@kiyora/editor';
import type { Board } from '@kiyora/model';
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
    };

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
          rewrite: loaded.migratedFrom !== null,
          status: 'ready',
          storage: library.storage(boardId),
          writable: true,
        });
        return;
      }

      if (loaded.status === 'empty') {
        setState({
          board: emptyBoard(boardId, Date.now(), title),
          fault: openFault,
          migratedFrom: null,
          rewrite: true,
          status: 'ready',
          storage: library.storage(boardId),
          writable: true,
        });
        return;
      }

      setState({
        board: emptyBoard(boardId, Date.now(), title),
        fault: loaded.fault,
        migratedFrom: null,
        rewrite: loaded.quarantined,
        status: 'ready',
        storage: library.storage(boardId),
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
