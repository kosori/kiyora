import { type Board, hasImageFiles, serializeBoard } from '@kiyora/model';
import type { Editor } from '../store';
import { faultOf, type StorageFault } from './faults';
import type { Presence } from './presence';
import type { BoardStorage, SaveStatus } from './storage';

/** How long autosave waits after the last change before it writes. */
export const AUTOSAVE_DELAY = 500;

/** One board as a save wrote it: the bytes stored, the board they carry, its picture. */
export type SavedBoard = {
  board: Board;
  bytes: string;
  /** The preview derived when the save was made, or null when there is none. */
  preview?: string | null;
};

/**
 * The board as a save writes it: the camera comes from the view, because the
 * view is the one that moves, and the time from the write, because it belongs
 * to the write and never to the document. Undo therefore cannot put an older
 * camera or time back.
 */
export const savedBoard = (
  board: Board,
  camera: Board['camera'],
  at: number
): SavedBoard => {
  const next = { ...board, camera, updatedAt: at };

  return { board: next, bytes: serializeBoard(next) };
};

export type AutosaveOptions = {
  /** The engine whose board is written. */
  editor: Editor;
  /** Where the board is written. */
  storage: BoardStorage;
  /** How long to wait after the last change. Defaults to `AUTOSAVE_DELAY`. */
  delay?: number;
  /**
   * When this save happened. Defaults to `Date.now`. The value is stamped into
   * the payload at write time, never into the editor's board, so it cannot be
   * captured by a history entry or restored by undo.
   */
  now?: () => number;
  /**
   * Whether this tab may write. When another tab holds the board, this one
   * yields rather than clobbering it, and takes over once the holder leaves.
   */
  presence?: Presence;
  /**
   * Called after a write that followed a change landed. A flush that carried
   * nothing new is not a change, so it does not call back: a background
   * reconciler listening here never uploads a board nobody edited.
   */
  onSaved?: (saved: SavedBoard) => void;
  /**
   * The board's picture, derived from its own paint. It is written with the
   * board so the library lists a preview without opening a payload. A preview
   * that cannot be produced leaves the stored one as it was and never fails the
   * save.
   */
  preview?: (board: Board) => string | null | Promise<string | null>;
};

export type Autosave = {
  /** Writes at once, without waiting out the debounce. A closing tab calls this. */
  flush: () => Promise<void>;
  /** Whether the board is saved, as of the last write. */
  getStatus: () => SaveStatus;
  /** The fault behind the last failed write, or null while writes land. */
  getFault: () => StorageFault | null;
  /** The bytes the last successful write stored, or null before the first one. */
  getLastWrite: () => SavedBoard | null;
  /** What the next write would store, without writing it. */
  snapshot: () => SavedBoard;
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
  now = Date.now,
  presence,
  onSaved,
  preview: previewBoardOf,
}: AutosaveOptions): Autosave => {
  let status: SaveStatus = 'saved';
  let fault: StorageFault | null = null;
  let changed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let revision = 0;
  let lastWrite: SavedBoard | null = null;
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
   * save stores are one shape. The camera and the save time are stamped here
   * rather than in the document, so undo can never put an older one back.
   */
  const snapshot = (): SavedBoard =>
    savedBoard(editor.getBoard(), editor.getView().camera, now());

  /**
   * The preview to store, or `undefined` when there is none to offer. A preview
   * that throws is treated as absent rather than as a failed save: the picture
   * is a cache, the board is not.
   */
  const previewOf = async (
    board: Board
  ): Promise<string | null | undefined> => {
    if (previewBoardOf === undefined) {
      return undefined;
    }
    try {
      return await previewBoardOf(board);
    } catch {
      return undefined;
    }
  };

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
    const carried = changed;
    setStatus('saving');
    try {
      const saved = snapshot();
      const picture = await previewOf(board);
      await storage.write(saved.bytes, picture);
      lastWrite = { ...saved, preview: picture ?? null };
      changed = false;
      setFault(null);
      setStatus(revision === writing ? 'saved' : 'unsaved');
      if (carried) {
        onSaved?.(saved);
      }
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
    getLastWrite: () => lastWrite,
    getStatus: () => status,
    snapshot,
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
