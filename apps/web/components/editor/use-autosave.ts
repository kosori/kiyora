'use client';

import {
  type Autosave,
  createAutosave,
  type Editor,
  loadBoard,
  restoreBoard,
  type SaveStatus,
} from '@kiyora/editor';
import { useEffect, useState } from 'react';
import { openBoardStorage } from '~/lib/board-storage';

/**
 * Opens the saved board into the engine, then keeps it saved. Returns the
 * status the indicator reads.
 *
 * The board is read once, on mount: a stored board replaces the starter and
 * brings the view back to where it was left, and only then does autosave start
 * watching, so opening a board is never itself a write. Writes are debounced by
 * the engine; a `pagehide` or a tab going hidden flushes whatever is pending, so
 * the last edit — or a pan that no edit armed — is not the one that gets lost.
 */
export const useAutosave = (editor: Editor): SaveStatus => {
  const [status, setStatus] = useState<SaveStatus>('saved');

  useEffect(() => {
    let cancelled = false;
    let autosave: Autosave | null = null;
    let unsubscribe: (() => void) | null = null;

    const flush = () => {
      autosave?.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    (async () => {
      try {
        const storage = await openBoardStorage();
        const stored = await loadBoard(storage);
        if (cancelled) {
          return;
        }
        if (stored !== null) {
          restoreBoard(editor, stored);
        }
        const created = createAutosave({ editor, storage });
        autosave = created;
        unsubscribe = created.subscribe(() => setStatus(created.getStatus()));
        setStatus(created.getStatus());
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', onVisibility);
      } catch {
        // Storage is unreadable; #18 turns this into a typed fault and a
        // surface. Until then the board opens as the starter and stays usable.
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe?.();
      autosave?.stop();
    };
  }, [editor]);

  return status;
};
