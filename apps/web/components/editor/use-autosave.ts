'use client';

import {
  type Autosave,
  createAutosave,
  createPresence,
  type Editor,
  loadBoard,
  type Presence,
  restoreBoard,
  type SaveStatus,
  type StorageFault,
} from '@kiyora/editor';
import { useEffect, useState } from 'react';
import { openPresenceChannel } from '~/lib/board-presence';
import { openBoardStorage } from '~/lib/board-storage';

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

const initialHealth: StorageHealth = {
  fault: null,
  migratedFrom: null,
  secondary: false,
  status: 'saved',
};

/**
 * Opens the saved board into the engine, then keeps it saved. Returns the health
 * the status surface reads.
 *
 * The board is read once, on mount. A stored board replaces the starter and
 * brings the view back to where it was left; an older one is lifted and reports
 * the version it came from; unreadable bytes are parked and reported. Only when
 * the bytes were either read or safely quarantined does autosave start watching,
 * so a bad read can never be papered over by a fresh board. A second tab on the
 * same board warns rather than writing over the first.
 */
export const useAutosave = (editor: Editor): StorageHealth => {
  const [health, setHealth] = useState<StorageHealth>(initialHealth);

  useEffect(() => {
    let cancelled = false;
    let autosave: Autosave | null = null;
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

    (async () => {
      try {
        const { fault: openFault, storage } = await openBoardStorage();
        const loaded = await loadBoard(storage);
        if (cancelled) {
          return;
        }

        const fault = loaded.status === 'fault' ? loaded.fault : openFault;
        const migratedFrom =
          loaded.status === 'loaded' ? loaded.migratedFrom : null;
        const quarantined = loaded.status === 'fault' && loaded.quarantined;
        if (loaded.status === 'loaded') {
          restoreBoard(editor, loaded.board);
        }

        const writable = loaded.status !== 'fault' || quarantined;
        if (!writable) {
          setHealth({
            fault,
            migratedFrom,
            secondary: false,
            status: 'unsaved',
          });
          return;
        }

        const channel = openPresenceChannel();
        const mine = createPresence({
          channel,
          self: { id: crypto.randomUUID(), openedAt: Date.now() },
        });
        presence = mine;

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
            fault: created.getFault() ?? fault,
            migratedFrom,
            secondary: !mine.isPrimary(),
            status: created.getStatus(),
          });
        };
        stops.push(created.subscribe(sync), mine.subscribe(sync));
        sync();

        if (migratedFrom !== null || quarantined) {
          // The bytes this replaced are in the snapshot or the quarantine, so
          // the board key is free: write what is now on screen, so the next
          // open is a clean one rather than another rescue.
          await created.flush();
        }

        window.addEventListener('pagehide', flush);
        window.addEventListener('pagehide', leave);
        document.addEventListener('visibilitychange', onVisibility);
      } catch {
        // A browser with no usable storage is reported by the storage opener's
        // fault; the starter board stays on screen and usable either way.
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const stop of stops) {
        stop();
      }
      presence?.leave();
      autosave?.stop();
    };
  }, [editor]);

  return health;
};
