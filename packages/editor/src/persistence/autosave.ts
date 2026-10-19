import type { Editor } from '../store';
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
};

export type Autosave = {
  /** Writes at once, without waiting out the debounce. A closing tab calls this. */
  flush: () => Promise<void>;
  /** Whether the board is saved, as of the last write. */
  getStatus: () => SaveStatus;
  /** Subscribes to status changes. Returns the unsubscribe. */
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
 */
export const createAutosave = ({
  editor,
  storage,
  delay = AUTOSAVE_DELAY,
}: AutosaveOptions): Autosave => {
  let status: SaveStatus = 'saved';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let revision = 0;
  const listeners = new Set<() => void>();

  const setStatus = (next: SaveStatus): void => {
    if (status === next) {
      return;
    }
    status = next;
    for (const listener of listeners) {
      listener();
    }
  };

  /**
   * The bytes to write. The camera comes from the view, not from the board: the
   * view is the one that moves, and the board's copy is only the snapshot the
   * previous save left behind.
   */
  const snapshot = (): string => {
    const board = editor.getBoard();
    return JSON.stringify({ ...board, camera: editor.getView().camera });
  };

  const write = async (): Promise<void> => {
    const writing = revision;
    setStatus('saving');
    try {
      await storage.write(snapshot());
      setStatus(revision === writing ? 'saved' : 'unsaved');
    } catch {
      // The typed faults — quota, blocked, corrupt, unavailable — slot in here.
      setStatus('unsaved');
    }
  };

  const arm = (): void => {
    revision += 1;
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

  return {
    flush: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      return write();
    },
    getStatus: () => status,
    stop: () => {
      stopWatching();
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
