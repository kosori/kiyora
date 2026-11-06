import {
  type Board,
  faultOf,
  StorageError,
  type StorageFault,
  utf8Length,
} from '@kiyora/model';
import {
  type ConflictPorts,
  type ConflictResolutions,
  createConflictResolutions,
} from './conflict-resolution';
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
  /**
   * Whether the local copy holds a change its upload has not accepted. A
   * recorded conflict supersedes this flag: a refused write sets it false on
   * purpose, because `conflict` now carries the only trace of the edit.
   */
  pending: boolean;
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
  | {
      status: 'error';
      reason: 'network' | 'unauthorized' | 'invalid' | 'server';
    }
  | { status: 'error'; reason: 'fault'; fault: StorageFault };

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
  /** Receives a cause the surface cannot show. Defaults to doing nothing. */
  report?: (error: unknown) => void;
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

/** The two operations the machine serialises, named so a queue keeps intent. */
type Operation = 'link' | 'reconcile';

/** A queued operation and the promise its caller awaits. */
type Pending = {
  operation: Operation;
  done: Promise<void>;
  resolve: () => void;
};

const defer = (): { promise: Promise<void>; resolve: () => void } => {
  let settle: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: () => settle?.() };
};

const sameState = (left: SyncState, right: SyncState): boolean =>
  left.status === right.status &&
  JSON.stringify(left) === JSON.stringify(right);

/**
 * The state machine both copies run. It decides nothing itself: the protocol
 * decides what a write may do, the transport carries it, and this only keeps
 * the order — link before sync, one upload at a time, and a conflict that a
 * later save cannot quietly clear.
 *
 * Concurrent requests queue by intent rather than collapsing to "sync again": a
 * link stays a link, and a reconcile queued behind a link re-checks the record
 * before it uploads anything.
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
  report = () => undefined,
}: SyncMachineOptions): SyncMachine => {
  let record = initialRecord;
  let running: Pending | null = null;
  const queue: Pending[] = [];
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
    if (record.pending) {
      return { revision: record.revision ?? 0, status: 'pending' };
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
    report,
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

  /**
   * Applies the guards `reconcile` and `markPending` share, in one place, and
   * answers whether one of them already named the state.
   */
  const reportBlockedState = (): boolean => {
    if (blocked()) {
      return true;
    }
    if (!record.linked) {
      setState({ status: 'local' });
      return true;
    }
    if (!signedIn) {
      setState({ status: 'signed-out' });
      return true;
    }
    if (record.conflict !== null) {
      setState({
        local: record.revision ?? 0,
        remote: record.conflict,
        status: 'conflict',
      });
      return true;
    }
    return false;
  };

  /**
   * Sends one write. A thrown `StorageError` is a fault; every other rejection
   * is the transient default, `network`, so a reconnect retries it.
   */
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
    } catch (error) {
      report(error);
      setState(
        error instanceof StorageError
          ? { fault: faultOf(error), reason: 'fault', status: 'error' }
          : { reason: 'network', status: 'error' }
      );
      return;
    }

    if (result.kind === 'accepted') {
      setRecord({
        conflict: null,
        linked: true,
        pending: false,
        revision: result.revision,
        tooLarge: false,
      });
      setState({ revision: result.revision, status: 'synced' });
      return;
    }

    if (result.kind === 'conflict') {
      setRecord({
        ...record,
        conflict: result.revision,
        linked: true,
        pending: false,
      });
      if (result.payload === null) {
        await resolutions.forget();
      } else {
        await resolutions.remember({
          payload: result.payload,
          revision: result.revision,
        });
      }
      setState({
        local: record.revision ?? 0,
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

  const linkNow = async (): Promise<void> => {
    if (record.linked) {
      return;
    }
    if (!signedIn) {
      setState({ status: 'signed-out' });
      return;
    }
    await upload(null);
  };

  const reconcileNow = async (): Promise<void> => {
    if (reportBlockedState()) {
      return;
    }
    await upload(record.revision);
  };

  const drain = async (): Promise<void> => {
    if (running !== null) {
      return;
    }
    const pending = queue.shift();
    if (pending === undefined) {
      return;
    }
    running = pending;
    try {
      await (pending.operation === 'link' ? linkNow() : reconcileNow());
    } catch (error) {
      report(error);
    } finally {
      running = null;
      pending.resolve();
    }
    await drain();
  };

  const request = (operation: Operation): Promise<void> => {
    if (operation === 'link' && running?.operation === 'link') {
      return running.done;
    }
    const queued = queue.find((pending) => pending.operation === operation);
    if (queued !== undefined) {
      return queued.done;
    }
    const deferred = defer();
    queue.push({
      done: deferred.promise,
      operation,
      resolve: deferred.resolve,
    });
    drain().catch(() => undefined);
    return deferred.promise;
  };

  return {
    conflict: resolutions,
    getState: () => state,
    isLinked: () => record.linked,
    link: () => (record.linked ? Promise.resolve() : request('link')),
    markPending: () => {
      if (record.linked && record.conflict === null && !record.pending) {
        setRecord({ ...record, pending: true });
      }
      const size = utf8Length(read().bytes);
      if (size > limit) {
        setTooLarge(size);
        return;
      }
      if (reportBlockedState()) {
        return;
      }
      setState({ revision: record.revision ?? 0, status: 'pending' });
    },
    reconcile: () => request('reconcile'),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
