import { type Board, faultOf, utf8Length } from '@kiyora/model';
import {
  type ConflictCache,
  type ConflictCopy,
  type ConflictCopyController,
  createConflictCopy,
} from './conflict-copy';
import type { SyncRecord, SyncSnapshot, SyncState } from './reconcile';
import type { DownloadedBoard, SyncTransport, UploadResult } from './transport';

/** The things a resolution does outside `sync`: storage and the open editor. */
export type ConflictPorts = {
  cache: ConflictCache;
  /**
   * Keeps the open board's bytes as its recovery snapshot, then writes `remote`
   * in their place. Returns the board it replaced, so the caller can offer it
   * back as a downloadable file.
   */
  replaceLocal: (remote: Board) => Promise<Board>;
  /** Copies the local board under a new id and returns the copy. */
  duplicateLocal: (
    local: Board
  ) => Promise<{ id: string; board: Board } | null>;
  /**
   * Removes a duplicate's payload, snapshot, quarantine and library entry, so
   * a resolution that cannot finish leaves nothing behind.
   */
  discardLocal: (id: string) => Promise<void>;
  /** Persists what sync learned about a board other than the open one. */
  saveRecordFor: (id: string, record: SyncRecord) => Promise<void>;
  /** Shows `board` through the editor's replacement path, clearing history. */
  adoptLocal: (board: Board) => void;
};

/** The three resolutions and what the surface needs to draw them. */
export type ConflictResolutions = {
  getCopy: () => ConflictCopy | null;
  /** Loads the remote copy from the cache, or fetches it when none is cached. */
  open: () => Promise<void>;
  /** Caches a remote copy a refused write carried, and shows it. */
  remember: (remote: DownloadedBoard) => Promise<void>;
  /** Drops a cached copy a refusal left behind, so the next resolution re-reads. */
  forget: () => Promise<void>;
  /** Uploads the local bytes at the remote revision. False leaves the conflict. */
  keepMine: () => Promise<boolean>;
  /** Returns the local board that was replaced, or null when nothing changed. */
  takeTheirs: () => Promise<Board | null>;
  /** Copies the local bytes to a new board, then takes the remote copy. */
  duplicateMine: () => Promise<boolean>;
};

export type ConflictDeps = {
  boardId: string;
  transport: SyncTransport;
  read: () => SyncSnapshot;
  signedIn: () => boolean;
  record: () => SyncRecord;
  /** Replaces the record and persists it. */
  setRecord: (record: SyncRecord) => void;
  setState: (state: SyncState) => void;
  publish: () => void;
  limit: number;
  ports: ConflictPorts;
  /** Receives a cause the surface cannot show directly. */
  report: (error: unknown) => void;
};

/**
 * The conflict half of the reconciler. It owns the three resolutions and the
 * remote copy held beside the board; the surface only names one. Nothing here
 * touches storage or the DOM directly: a port does.
 *
 * A `replaceLocal` failure leaves the conflict where it was. Once the swap has
 * succeeded the resolution is committed: every later step is best-effort and
 * reported, but never rolled back, so the record is written before the editor
 * is told to adopt the new board.
 */
export const createConflictResolutions = ({
  boardId,
  transport,
  read,
  signedIn,
  record,
  setRecord,
  setState,
  publish,
  limit,
  ports,
  report,
}: ConflictDeps): ConflictResolutions => {
  const copy: ConflictCopyController = createConflictCopy({
    boardId,
    cache: ports.cache,
    publish,
    record,
    signedIn,
    transport,
  });

  const conflictState = (local: number, remote: number): SyncState => ({
    local,
    remote,
    status: 'conflict',
  });

  const tooLarge = (bytes: number): void => {
    setRecord({ ...record(), tooLarge: true });
    setState({ bytes, limit, status: 'too-large' });
  };

  const attempt = (step: () => void): void => {
    try {
      step();
    } catch (error) {
      report(error);
    }
  };

  const applyRemote = async (remote: {
    board: Board;
    revision: number;
  }): Promise<Board | null> => {
    const current = record();
    const local = current.revision ?? 0;
    const previousConflict = current.conflict ?? 0;

    let replaced: Board;
    try {
      replaced = await ports.replaceLocal(remote.board);
    } catch (error) {
      report(error);
      setState(conflictState(local, previousConflict));
      return null;
    }

    attempt(() =>
      setRecord({
        conflict: null,
        linked: true,
        pending: false,
        revision: remote.revision,
        tooLarge: false,
      })
    );
    attempt(() => ports.adoptLocal(remote.board));
    try {
      await copy.forget();
    } catch (error) {
      report(error);
    }
    attempt(() =>
      setState(
        signedIn()
          ? { revision: remote.revision, status: 'synced' }
          : { status: 'signed-out' }
      )
    );
    return replaced;
  };

  const keepMine = async (): Promise<boolean> => {
    const current = record();
    if (current.conflict === null) {
      return false;
    }
    if (!signedIn()) {
      setState({ status: 'signed-out' });
      return false;
    }

    const { board, bytes, preview } = read();
    const size = utf8Length(bytes);
    if (size > limit) {
      tooLarge(size);
      return false;
    }

    setState({ revision: current.conflict, status: 'syncing' });

    let result: UploadResult;
    try {
      result = await transport.upload({
        baseRevision: current.conflict,
        id: boardId,
        payload: board,
        preview,
      });
    } catch (error) {
      report(error);
      setState(conflictState(current.revision ?? 0, current.conflict));
      return false;
    }

    if (result.kind === 'accepted') {
      setRecord({
        conflict: null,
        linked: true,
        pending: false,
        revision: result.revision,
        tooLarge: false,
      });
      await copy.forget();
      setState({ revision: result.revision, status: 'synced' });
      return true;
    }

    if (result.kind === 'conflict') {
      setRecord({ ...record(), conflict: result.revision, pending: false });
      if (result.payload === null) {
        await copy.forget();
      } else {
        await copy.remember({
          payload: result.payload,
          revision: result.revision,
        });
      }
      setState(conflictState(current.revision ?? 0, result.revision));
      return false;
    }

    if (result.kind === 'too-large') {
      tooLarge(result.bytes);
      return false;
    }

    if (result.kind === 'network') {
      setState(conflictState(current.revision ?? 0, current.conflict));
      return false;
    }

    setState({
      reason: result.kind === 'unauthorized' ? 'unauthorized' : result.kind,
      status: 'error',
    });
    return false;
  };

  const takeTheirs = async (): Promise<Board | null> => {
    if (record().conflict === null) {
      return null;
    }

    const ready = await copy.ensureReadyCopy();
    if (ready === null) {
      return null;
    }

    return applyRemote({ board: ready.board, revision: ready.revision });
  };

  const duplicateMine = async (): Promise<boolean> => {
    const current = record();
    if (current.conflict === null) {
      return false;
    }
    if (!signedIn()) {
      setState({ status: 'signed-out' });
      return false;
    }

    const local = read();
    const size = utf8Length(local.bytes);
    if (size > limit) {
      tooLarge(size);
      return false;
    }

    let duplicated: { id: string; board: Board };
    try {
      const result = await ports.duplicateLocal(local.board);
      if (result === null) {
        return false;
      }
      duplicated = result;
    } catch (error) {
      report(error);
      setState({ fault: faultOf(error), reason: 'fault', status: 'error' });
      return false;
    }

    const rollback = async (): Promise<boolean> => {
      let failure: unknown = null;
      try {
        await transport.remove(duplicated.id);
      } catch (error) {
        failure = error;
        report(error);
      }
      try {
        await ports.discardLocal(duplicated.id);
      } catch (error) {
        failure ??= error;
        report(error);
      }
      if (failure === null) {
        return true;
      }
      setState({ fault: faultOf(failure), reason: 'fault', status: 'error' });
      return false;
    };

    const failed = async (): Promise<false> => {
      if (await rollback()) {
        setState(conflictState(record().revision ?? 0, record().conflict ?? 0));
      }
      return false;
    };

    setState({ revision: 0, status: 'syncing' });

    let result: UploadResult;
    try {
      result = await transport.upload({
        baseRevision: null,
        id: duplicated.id,
        payload: duplicated.board,
        preview: local.preview,
      });
    } catch (error) {
      report(error);
      return await failed();
    }

    if (result.kind !== 'accepted') {
      return await failed();
    }

    const ready = await copy.ensureReadyCopy();
    if (ready === null) {
      return await failed();
    }

    try {
      await ports.saveRecordFor(duplicated.id, {
        conflict: null,
        linked: true,
        pending: false,
        revision: result.revision,
        tooLarge: false,
      });
    } catch (error) {
      report(error);
      return await failed();
    }

    const replaced = await applyRemote({
      board: ready.board,
      revision: ready.revision,
    });
    if (replaced === null) {
      return await failed();
    }
    return true;
  };

  return {
    duplicateMine,
    forget: copy.forget,
    getCopy: copy.getCopy,
    keepMine,
    open: copy.open,
    remember: copy.remember,
    takeTheirs,
  };
};
