'use client';

import {
  type BoardStorage,
  boardConflictKey,
  boardKey,
  boardSnapshotKey,
  copyTitle,
  createLibrary,
  faultOf,
  type LibraryEntry,
  type StorageFault,
} from '@kiyora/editor';
import {
  type Board,
  parseBoard,
  previewBoard,
  serializeBoard,
} from '@kiyora/model';
import type { ConflictPorts, DownloadedBoard, SyncRecord } from '@kiyora/sync';
import { useEffect, useState } from 'react';
import { openStore } from './board-storage';
import { iconSetFor } from './icon-set';
import { emptyBoard, mintBoardId, UNTITLED } from './new-board';
import { createTextMeasurer } from './text-measurer';

/**
 * What the board route shows: loading, not in this library, a storage failure
 * that kept it from being read, or one board. A `fault` says the browser could
 * not open its storage, so the board may still be there and the address is not
 * reported as missing.
 */
export type BoardRouteState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'fault'; fault: StorageFault }
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
      /** The storage a conflict resolution writes through. */
      conflict: Omit<ConflictPorts, 'adoptLocal'>;
      /** The picture the list shows for this board, for the conflict surface. */
      preview?: string;
      /**
       * Commits a new name through the same library the list reads, payload
       * first. Null when the library no longer holds the board.
       */
      rename: (title: string) => Promise<LibraryEntry | null>;
    };

/** The sync record a library entry carries, read without opening a payload. */
const syncOf = (entry: LibraryEntry | undefined): SyncRecord => ({
  conflict: entry?.conflict ?? null,
  linked: entry?.linked === true && typeof entry.revision === 'number',
  pending: entry?.pending === true,
  revision: entry?.revision ?? null,
  tooLarge: entry?.tooLarge === true,
});

/** The fields every ready board shares, built from the one library the route opened. */
type ReadyState = Extract<BoardRouteState, { status: 'ready' }>;

/** One remote copy cached beside its board, or null when the bytes will not read. */
const readCached = (bytes: string | null): DownloadedBoard | null => {
  if (bytes === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(bytes) as {
      payload?: unknown;
      revision?: unknown;
    };
    if (typeof parsed.revision !== 'number') {
      return null;
    }
    return { payload: parseBoard(parsed.payload), revision: parsed.revision };
  } catch {
    return null;
  }
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
    setState({ status: 'loading' });

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
        // The record is a cache, so a failed write never blocks the edit; a
        // persistent failure still merges into the board's fault surface.
        try {
          await library.setSync(boardId, record);
        } catch (error) {
          if (cancelled) {
            return;
          }
          setState((current) =>
            current.status === 'ready'
              ? { ...current, fault: current.fault ?? faultOf(error) }
              : current
          );
        }
      };
      const measure = createTextMeasurer();
      const previewOf = async (board: Board): Promise<string | null> =>
        previewBoard(board, {
          icons: await iconSetFor(board),
          measure,
          theme: board.settings.theme,
        });
      const conflict: Omit<ConflictPorts, 'adoptLocal'> = {
        cache: {
          clear: () => store.delete(boardConflictKey(boardId)),
          read: async () =>
            readCached(await store.get(boardConflictKey(boardId))),
          write: (remote) =>
            store.put(
              boardConflictKey(boardId),
              JSON.stringify({
                payload: remote.payload,
                revision: remote.revision,
              })
            ),
        },
        discardLocal: async (id) => {
          await library.remove(id);
        },
        duplicateLocal: async (local) => {
          const copy: Board = {
            ...local,
            createdAt: Date.now(),
            id: mintBoardId(),
            title: copyTitle(local.title),
            updatedAt: Date.now(),
          };
          const svg = await previewOf(copy);
          await library.storage(copy.id).write(serializeBoard(copy), svg);
          return { board: copy, id: copy.id };
        },
        replaceLocal: async (remote) => {
          const [before, loaded] = await Promise.all([
            store.get(boardKey(boardId)),
            library.load(boardId),
          ]);
          if (before !== null) {
            await store.put(boardSnapshotKey(boardId), before);
          }
          const svg = await previewOf(remote);
          await library.storage(boardId).write(serializeBoard(remote), svg);
          return loaded.status === 'loaded'
            ? loaded.board
            : emptyBoard(boardId, Date.now(), remote.title);
        },
        saveRecordFor: async (id, record) => {
          await library.setSync(id, record);
        },
      };
      const loaded = await library.load(boardId);
      if (cancelled) {
        return;
      }

      const title = entry?.title || UNTITLED;
      // A board that would not read names its own fault; otherwise the fault is
      // the one that opened this storage, so neither is ever dropped.
      const fault = loaded.status === 'fault' ? loaded.fault : openFault;
      const shared = {
        conflict,
        preview: entry?.preview,
        recordSync,
        rename: (next: string) => library.rename(boardId, next),
        storage: library.storage(boardId),
        sync,
      } satisfies Pick<
        ReadyState,
        'conflict' | 'preview' | 'recordSync' | 'rename' | 'storage' | 'sync'
      >;

      if (loaded.status === 'loaded') {
        setState({
          ...shared,
          board: loaded.board,
          fault,
          migratedFrom: loaded.migratedFrom,
          rewrite: loaded.migratedFrom !== null,
          status: 'ready',
          writable: true,
        });
        return;
      }

      if (loaded.status === 'empty') {
        setState({
          ...shared,
          board: emptyBoard(boardId, Date.now(), title),
          fault,
          migratedFrom: null,
          rewrite: true,
          status: 'ready',
          writable: true,
        });
        return;
      }

      setState({
        ...shared,
        board: emptyBoard(boardId, Date.now(), title),
        fault,
        migratedFrom: null,
        rewrite: loaded.quarantined,
        status: 'ready',
        writable: loaded.quarantined,
      });
    })().catch((error: unknown) => {
      if (!cancelled) {
        setState({ fault: faultOf(error), status: 'fault' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  return state;
};
