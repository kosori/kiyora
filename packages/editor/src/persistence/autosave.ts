import { type Board, hasImageFiles, serializeBoard } from '@kiyora/model';
import type { Editor } from '../store';
import { faultOf, type StorageFault } from './faults';
import type { Presence } from './presence';
import type { BoardStorage, SaveStatus } from './storage';

/** How long autosave waits after the last change before it writes. */
export const AUTOSAVE_DELAY = 500;

export type AutosaveOptions = {
  /** The engine whose board is written. */
  editor: Editor;
  /** Where the board is written. */
  storage: BoardStorage;
  /** How long to wait after the last change. Defaults to `AUTOSAVE_DELAY`. */
  delay?: number;
  /**
   * Whether this tab may write. When another tab holds the board, this one
   * yields rather than clobbering it, and takes over once the holder leaves.
   */
  presence?: Presence;
};

export type Autosave = {
  /** Writes at once, without waiting out the debounce. A closing tab calls this. */
  flush: () => Promise<void>;
  /** Whether the board is saved, as of the last write. */
  getStatus: () => SaveStatus;
  /** The fault behind the last failed write, or null while writes land. */
  getFault: () => StorageFault | null;
  /** Subscribes to status or fault changes. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Stops observing the board. Anything still pending is dropped unwritten. */
  stop: () => void;
};

/**
 * Writes the board to `storage` a short moment after the last change, so a run
 * of edits costs one write rather than one per keystroke, and a change that is
 * still pending can be flushed at once when the tab is closing.
 *
 * It watches board changes only. A camera change does not arm the debounce, so a
 * pan is still not a save — but because the camera is read from the view at
 * write time, whichever write does happen carries the latest camera with it, and
 * the flush on close carries a pan that happened after the last edit.
 *
 * A failed write leaves the board in memory and records the fault, so the shell
 * can say which of quota, blocked, corrupt or unavailable it was. A write is
 * skipped entirely while another tab holds the board, so the first tab's work is
 * never overwritten.
 *
 * A store that cannot hold image payloads — the localStorage fallback — refuses
 * a board carrying one instead of writing a file whose pictures are missing. It
 * records the `images` fault, so the refusal is visible rather than a save that
 * quietly loses half the document.
 */
export const createAutosave = ({
  editor,
  storage,
  delay = AUTOSAVE_DELAY,
  presence,
}: AutosaveOptions): Autosave => {
  let status: SaveStatus = 'saved';
  let fault: StorageFault | null = null;
  let changed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let revision = 0;
  const listeners = new Set<() => void>();

  const publish = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const setStatus = (next: SaveStatus): void => {
    if (status === next) {
      return;
    }
    status = next;
    publish();
  };

  const setFault = (next: StorageFault | null): void => {
    const key = (value: StorageFault | null): string =>
      value === null
        ? 'none'
        : value.kind === 'corrupt'
          ? `corrupt:${value.reason}`
          : value.kind;
    if (key(fault) === key(next)) {
      return;
    }
    fault = next;
    publish();
  };

  /**
   * The bytes to write: the board file, so what autosave stores and what a file
   * save stores are one shape. The camera comes from the view, not from the
   * board: the view is the one that moves, and the board's copy is only the
   * snapshot the previous save left behind.
   */
  const snapshot = (board: Board): string =>
    serializeBoard({ ...board, camera: editor.getView().camera });

  const write = async (): Promise<void> => {
    if (presence !== undefined && !presence.isPrimary()) {
      setStatus('unsaved');
      return;
    }
    const board = editor.getBoard();
    if (storage.supportsFiles === false && hasImageFiles(board)) {
      setFault({ kind: 'images' });
      setStatus('unsaved');
      return;
    }
    const writing = revision;
    setStatus('saving');
    try {
      await storage.write(snapshot(board));
      changed = false;
      setFault(null);
      setStatus(revision === writing ? 'saved' : 'unsaved');
    } catch (error) {
      setFault(faultOf(error));
      setStatus('unsaved');
    }
  };

  const arm = (): void => {
    revision += 1;
    changed = true;
    setStatus('unsaved');
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      write();
    }, delay);
  };

  const stopWatching = editor.subscribe(arm);
  const stopPresence = presence?.subscribe(() => {
    if (presence.isPrimary() && changed) {
      arm();
    }
  });

  return {
    flush: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      return write();
    },
    getFault: () => fault,
    getStatus: () => status,
    stop: () => {
      stopWatching();
      stopPresence?.();
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
