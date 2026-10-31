'use client';

import {
  type BoardStorage,
  boardConflictKey,
  boardKey,
  boardSnapshotKey,
  createLibrary,
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
import { emptyBoard, UNTITLED } from './new-board';
import { createTextMeasurer } from './text-measurer';

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

/** The title a conflict duplicate wears, the way the library names a copy. */
const copyTitle = (title: string): string =>
  title.trim() === '' ? 'Untitled copy' : `${title} copy`;

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
        duplicateLocal: async (local) => {
          const copy: Board = {
            ...local,
            createdAt: Date.now(),
            id: crypto.randomUUID(),
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
      if (loaded.status === 'loaded') {
        setState({
          board: loaded.board,
          conflict,
          fault: openFault,
          migratedFrom: loaded.migratedFrom,
          preview: entry?.preview,
          recordSync,
          rename: (title) => library.rename(boardId, title),
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
          conflict,
          fault: openFault,
          migratedFrom: null,
          preview: entry?.preview,
          recordSync,
          rename: (title) => library.rename(boardId, title),
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
        conflict,
        fault: loaded.fault,
        migratedFrom: null,
        preview: entry?.preview,
        recordSync,
        rename: (title) => library.rename(boardId, title),
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
