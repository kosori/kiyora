'use client';

import {
  type Autosave,
  type BoardStorage,
  type ClipboardRelay,
  createAutosave,
  createClipboardRelay,
  createPresence,
  type Editor,
  type Presence,
  type SaveStatus,
  type StorageFault,
} from '@kiyora/editor';
import { useEffect, useState } from 'react';
import { openBoardChannel } from '~/lib/board-channel';

/** Everything the shell needs to tell the truth about where the board is. */
export type StorageHealth = {
  /** Whether the last write landed, as of the debounce. */
  status: SaveStatus;
  /** The problem standing between the board and disk, if any. */
  fault: StorageFault | null;
  /** The version the stored board was lifted from, when a migration ran. */
  migratedFrom: number | null;
  /** Whether another tab holds the board, so this one may not write it. */
  secondary: boolean;
};

/** What the route hands the hook after it has opened and read one board. */
export type AutosaveSetup = {
  /** The board this tab has open; presence and the clipboard are scoped to it. */
  boardId: string;
  storage: BoardStorage;
  /** The fault that stood in the way of opening the board, if any. */
  fault?: StorageFault | null;
  /** The version the board was lifted from, when a migration ran. */
  migratedFrom?: number | null;
  /** Whether this board may be written. False when storage could not be read. */
  writable?: boolean;
  /** Whether opening should write what is on screen at once, after a rescue. */
  rewrite?: boolean;
};

const initialHealth: StorageHealth = {
  fault: null,
  migratedFrom: null,
  secondary: false,
  status: 'saved',
};

/**
 * Keeps the board in `editor` saved through its own storage. Returns the health
 * the status surface reads.
 *
 * Autosave starts only when the route says the board is writable: a bad read
 * that could not be quarantined never gets papered over by a fresh board. After
 * a migration or a quarantine the route asks for a rewrite, so the next open is
 * a clean one rather than another rescue. A second tab on the same board warns
 * rather than writing over the first.
 */
export const useAutosave = (
  editor: Editor,
  {
    boardId,
    storage,
    fault: initialFault = null,
    migratedFrom = null,
    writable = true,
    rewrite = false,
  }: AutosaveSetup
): StorageHealth => {
  const [health, setHealth] = useState<StorageHealth>({
    ...initialHealth,
    fault: initialFault,
    migratedFrom,
    status: writable ? initialHealth.status : 'unsaved',
  });

  useEffect(() => {
    if (!writable) {
      return;
    }

    let cancelled = false;
    let autosave: Autosave | null = null;
    let clipboard: ClipboardRelay | null = null;
    let presence: Presence | null = null;
    const stops: Array<() => void> = [];

    const flush = (): void => {
      autosave?.flush();
    };
    const leave = (): void => {
      presence?.leave();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    const channel = openBoardChannel(boardId);
    const self = { id: crypto.randomUUID(), openedAt: Date.now() };
    const mine = createPresence({ channel, self });
    presence = mine;
    clipboard = createClipboardRelay({
      boardId,
      channel,
      editor,
      origin: self.id,
    });

    const created = createAutosave({
      editor,
      presence: mine,
      storage,
    });
    autosave = created;

    const sync = (): void => {
      if (cancelled) {
        return;
      }
      setHealth({
        fault: created.getFault() ?? initialFault,
        migratedFrom,
        secondary: !mine.isPrimary(),
        status: created.getStatus(),
      });
    };
    stops.push(created.subscribe(sync), mine.subscribe(sync));
    sync();

    if (rewrite) {
      // The bytes this replaced are in the snapshot or the quarantine, so the
      // board key is free: write what is now on screen, so the next open is a
      // clean one rather than another rescue.
      created.flush().catch(() => undefined);
    }

    window.addEventListener('pagehide', flush);
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const stop of stops) {
        stop();
      }
      clipboard?.close();
      presence?.leave();
      autosave?.stop();
    };
  }, [boardId, editor, initialFault, migratedFrom, rewrite, storage, writable]);

  return health;
};
