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
  savedBoard,
} from '@kiyora/editor';
import { type Board, previewBoard } from '@kiyora/model';
import {
  createSyncMachine,
  type SyncRecord,
  type SyncSnapshot,
  type SyncState,
  type SyncTransport,
} from '@kiyora/sync';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openBoardChannel } from '~/lib/board-channel';
import { iconSetFor } from '~/lib/icon-set';
import { createTextMeasurer } from '~/lib/text-measurer';

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

/** What the shell needs to show and start a board's remote copy. */
export type SyncView = {
  /** Where the local copy stands against the remote one. */
  state: SyncState;
  /** Links this board: the only path from local to remote. */
  link: () => void;
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
  /** The account the server read, and the record sync keeps for this board. */
  sync: {
    signedIn: boolean;
    record: SyncRecord;
    saveRecord: (record: SyncRecord) => void;
    transport: SyncTransport;
  };
};

/** What the shell gets back: where the board is saved, and where it is synced. */
export type AutosaveHandle = {
  health: StorageHealth;
  sync: SyncView;
};

const initialHealth: StorageHealth = {
  fault: null,
  migratedFrom: null,
  secondary: false,
  status: 'saved',
};

const retryable = (state: SyncState): boolean =>
  state.status === 'pending' ||
  (state.status === 'error' && state.reason === 'network');

/**
 * Keeps the board in `editor` saved through its own storage, and reconciles a
 * linked board's remote copy after a save. Returns the health the status
 * surface reads and the sync state beside it.
 *
 * Autosave starts only when the route says the board is writable: a bad read
 * that could not be quarantined never gets papered over by a fresh board. After
 * a migration or a quarantine the route asks for a rewrite, so the next open is
 * a clean one rather than another rescue. A second tab on the same board warns
 * rather than writing over the first.
 *
 * A changed save wakes the reconciler in the background. A bare flush — the
 * page hiding, or a rescue rewrite — carries nothing new and does not upload.
 * The reconciler never blocks an edit and runs one upload at a time; online and
 * a returned tab retry a pending upload.
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
    sync,
  }: AutosaveSetup
): AutosaveHandle => {
  const [health, setHealth] = useState<StorageHealth>({
    ...initialHealth,
    fault: initialFault,
    migratedFrom,
    status: writable ? initialHealth.status : 'unsaved',
  });
  const autosaveRef = useRef<Autosave | null>(null);

  const read = useCallback(
    (): SyncSnapshot =>
      autosaveRef.current?.getLastWrite() ??
      savedBoard(editor.getBoard(), editor.getView().camera, Date.now()),
    [editor]
  );

  const [machine] = useState(() =>
    createSyncMachine({
      boardId,
      read,
      record: sync.record,
      saveRecord: sync.saveRecord,
      signedIn: sync.signedIn,
      transport: sync.transport,
    })
  );
  const [syncState, setSyncState] = useState<SyncState>(() =>
    machine.getState()
  );

  useEffect(
    () => machine.subscribe(() => setSyncState(machine.getState())),
    [machine]
  );

  const link = useCallback(() => {
    const run = async (): Promise<void> => {
      await autosaveRef.current?.flush();
      await machine.link();
    };

    run().catch(() => undefined);
  }, [machine]);

  const measure = useMemo(() => createTextMeasurer(), []);
  const preview = useCallback(
    async (board: Board): Promise<string | null> =>
      previewBoard(board, {
        icons: await iconSetFor(board),
        measure,
        theme: board.settings.theme,
      }),
    [measure]
  );

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
    const retry = (): void => {
      machine.reconcile().catch(() => undefined);
    };
    const onVisible = (): void => {
      if (
        document.visibilityState === 'visible' &&
        retryable(machine.getState())
      ) {
        retry();
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
      onSaved: () => {
        machine.markPending();
        machine.reconcile().catch(() => undefined);
      },
      presence: mine,
      preview,
      storage,
    });
    autosave = created;
    autosaveRef.current = created;

    const update = (): void => {
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
    stops.push(created.subscribe(update), mine.subscribe(update));
    update();

    if (rewrite) {
      // The bytes this replaced are in the snapshot or the quarantine, so the
      // board key is free: write what is now on screen, so the next open is a
      // clean one rather than another rescue.
      created.flush().catch(() => undefined);
    }

    window.addEventListener('pagehide', flush);
    window.addEventListener('pagehide', leave);
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('visibilitychange', onVisible);
      for (const stop of stops) {
        stop();
      }
      clipboard?.close();
      presence?.leave();
      autosave?.stop();
      autosaveRef.current = null;
    };
  }, [
    boardId,
    editor,
    initialFault,
    machine,
    migratedFrom,
    preview,
    rewrite,
    storage,
    writable,
  ]);

  return { health, sync: { link, state: syncState } };
};
