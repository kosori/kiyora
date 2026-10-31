import { type Board, utf8Length } from '@kiyora/model';
import {
  type ConflictPorts,
  type ConflictResolutions,
  createConflictResolutions,
} from './conflict';
import { SYNC_LIMIT_BYTES } from './protocol';
import type { SyncTransport, UploadResult } from './transport';

/** The local copy as the reconciler reads it: the board, its bytes and its picture. */
export type SyncSnapshot = {
  board: Board;
  bytes: string;
  /** The preview the last save stored, or null when it had none to offer. */
  preview: string | null;
};

/** What the library record remembers about a board's remote copy. */
export type SyncRecord = {
  linked: boolean;
  /** The revision the local copy was built on, or null when it is not linked. */
  revision: number | null;
  /** The remote revision that refused a write, until a person resolves it. */
  conflict: number | null;
  /** Whether the last size check found the board over the sync limit. */
  tooLarge: boolean;
};

/** Where a board's bytes stand against its remote copy. */
export type SyncState =
  | { status: 'local' }
  | { status: 'pending'; revision: number }
  | { status: 'syncing'; revision: number }
  | { status: 'synced'; revision: number }
  | { status: 'conflict'; local: number; remote: number }
  | { status: 'too-large'; bytes: number; limit: number }
  | { status: 'signed-out' }
  | { status: 'error'; reason: 'network' | 'unauthorized' | 'invalid' };

export type SyncMachineOptions = {
  boardId: string;
  transport: SyncTransport;
  read: () => SyncSnapshot;
  /** Whether the person is signed in now. A signed-out board sends nothing. */
  signedIn: boolean;
  /** What the library record holds for this board when the machine starts. */
  record: SyncRecord;
  /** Persists what the machine learned, so a conflict survives a reload. */
  saveRecord: (record: SyncRecord) => void;
  /** The storage and editor ports a conflict resolution needs. */
  conflict: ConflictPorts;
  /** Room for a test to lower the limit. Defaults to `SYNC_LIMIT_BYTES`. */
  limit?: number;
};

/** The reconciler for one board, driven by the surface that owns it. */
export type SyncMachine = {
  getState: () => SyncState;
  /** Whether the board has a remote copy, including after a successful link. */
  isLinked: () => boolean;
  subscribe: (listener: () => void) => () => void;
  /** Links this board explicitly: one upload at `baseRevision: null`. */
  link: () => Promise<void>;
  /** Marks a local save as waiting for its upload. */
  markPending: () => void;
  /** Uploads a linked board after a save, on reconnect or on visibility. */
  reconcile: () => Promise<void>;
  /** The three ways out of a conflict, and the remote copy they compare against. */
  conflict: ConflictResolutions;
};

const sameState = (left: SyncState, right: SyncState): boolean =>
  left.status === right.status &&
  JSON.stringify(left) === JSON.stringify(right);

/**
 * The state machine both copies run. It decides nothing itself: the protocol
 * decides what a write may do, the transport carries it, and this only keeps
 * the order — link before sync, one upload at a time, and a conflict that a
 * later save cannot quietly clear.
 */
export const createSyncMachine = ({
  boardId,
  transport,
  read,
  signedIn,
  record: initialRecord,
  saveRecord,
  conflict: conflictPorts,
  limit = SYNC_LIMIT_BYTES,
}: SyncMachineOptions): SyncMachine => {
  let record = initialRecord;
  let inFlight: Promise<void> | null = null;
  let queued = false;
  const listeners = new Set<() => void>();

  const publish = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const initial = (): SyncState => {
    const size = utf8Length(read().bytes);
    if (size > limit) {
      return { bytes: size, limit, status: 'too-large' };
    }
    if (record.conflict !== null) {
      return {
        local: record.revision ?? 0,
        remote: record.conflict,
        status: 'conflict',
      };
    }
    if (!record.linked) {
      return { status: 'local' };
    }
    if (!signedIn) {
      return { status: 'signed-out' };
    }
    return { revision: record.revision ?? 0, status: 'synced' };
  };

  let state = initial();

  const setState = (next: SyncState): void => {
    if (sameState(state, next)) {
      return;
    }
    state = next;
    publish();
  };

  const setRecord = (next: SyncRecord): void => {
    record = next;
    saveRecord(record);
  };

  const resolutions = createConflictResolutions({
    boardId,
    limit,
    ports: conflictPorts,
    publish,
    read,
    record: () => record,
    setRecord,
    setState,
    signedIn: () => signedIn,
    transport,
  });

  const setTooLarge = (bytes: number): void => {
    setRecord({ ...record, tooLarge: true });
    setState({ bytes, limit, status: 'too-large' });
  };

  const blocked = (): boolean =>
    state.status === 'error' && state.reason === 'unauthorized';

  const upload = async (baseRevision: number | null): Promise<void> => {
    const { board, bytes, preview } = read();
    const size = utf8Length(bytes);

    if (size > limit) {
      setTooLarge(size);
      return;
    }

    setState({ revision: baseRevision ?? 0, status: 'syncing' });

    let result: UploadResult;
    try {
      result = await transport.upload({
        baseRevision,
        id: boardId,
        payload: board,
        preview,
      });
    } catch {
      setState({ reason: 'network', status: 'error' });
      return;
    }

    if (result.kind === 'accepted') {
      setRecord({
        conflict: null,
        linked: true,
        revision: result.revision,
        tooLarge: false,
      });
      setState({ revision: result.revision, status: 'synced' });
      return;
    }

    if (result.kind === 'conflict') {
      setRecord({ ...record, conflict: result.revision, linked: true });
      if (result.payload !== null) {
        await resolutions.remember({
          payload: result.payload,
          revision: result.revision,
        });
      }
      setState({
        local: baseRevision ?? 0,
        remote: result.revision,
        status: 'conflict',
      });
      return;
    }

    if (result.kind === 'too-large') {
      setTooLarge(result.bytes);
      return;
    }

    setState({
      reason: result.kind === 'unauthorized' ? 'unauthorized' : result.kind,
      status: 'error',
    });
  };

  const start = (baseRevision: number | null): Promise<void> => {
    if (inFlight !== null) {
      queued = true;
      return inFlight;
    }

    inFlight = upload(baseRevision).finally(() => {
      inFlight = null;
      if (queued) {
        queued = false;
        reconcile().catch(() => undefined);
      }
    });

    return inFlight;
  };

  const reconcile = async (): Promise<void> => {
    if (blocked()) {
      return;
    }
    if (!record.linked) {
      setState({ status: 'local' });
      return;
    }
    if (!signedIn) {
      setState({ status: 'signed-out' });
      return;
    }
    if (record.conflict !== null) {
      setState({
        local: record.revision ?? 0,
        remote: record.conflict,
        status: 'conflict',
      });
      return;
    }

    await start(record.revision);
  };

  return {
    conflict: resolutions,
    getState: () => state,
    isLinked: () => record.linked,
    link: async () => {
      if (record.linked) {
        return;
      }
      if (!signedIn) {
        setState({ status: 'signed-out' });
        return;
      }
      await start(null);
    },
    markPending: () => {
      const size = utf8Length(read().bytes);
      if (size > limit) {
        setTooLarge(size);
        return;
      }
      if (blocked()) {
        return;
      }
      if (!record.linked) {
        setState({ status: 'local' });
        return;
      }
      if (!signedIn) {
        setState({ status: 'signed-out' });
        return;
      }
      if (record.conflict !== null) {
        setState({
          local: record.revision ?? 0,
          remote: record.conflict,
          status: 'conflict',
        });
        return;
      }
      setState({ revision: record.revision ?? 0, status: 'pending' });
    },
    reconcile,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
