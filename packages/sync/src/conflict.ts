import { type Board, utf8Length } from '@kiyora/model';
import type { SyncRecord, SyncSnapshot, SyncState } from './reconcile';
import type { DownloadedBoard, SyncTransport, UploadResult } from './transport';

/** The remote copy a person is comparing against, as the surface shows it. */
export type ConflictCopy =
  | { status: 'loading' }
  | { status: 'ready'; board: Board; revision: number }
  | { status: 'offline' };

/** Where the remote payload waits while the conflict is unresolved. */
export type ConflictCache = {
  read: () => Promise<DownloadedBoard | null>;
  write: (remote: DownloadedBoard) => Promise<void>;
  clear: () => Promise<void>;
};

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
};

const sameCopy = (left: ConflictCopy | null, right: ConflictCopy | null) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * The conflict half of the reconciler. It owns the three resolutions and the
 * remote copy held beside the board; the surface only names one. Nothing here
 * touches storage or the DOM directly: a port does, and a failed write leaves
 * the conflict where it was.
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
}: ConflictDeps): ConflictResolutions => {
  let copy: ConflictCopy | null = null;
  let opening = false;

  const show = (next: ConflictCopy | null): void => {
    if (sameCopy(copy, next)) {
      return;
    }
    copy = next;
    publish();
  };

  const conflictState = (local: number, remote: number): SyncState => ({
    local,
    remote,
    status: 'conflict',
  });

  const tooLarge = (bytes: number): void => {
    setRecord({ ...record(), tooLarge: true });
    setState({ bytes, limit, status: 'too-large' });
  };

  const readyCopy = (): Extract<ConflictCopy, { status: 'ready' }> | null =>
    copy?.status === 'ready' ? copy : null;

  const remember = async (remote: DownloadedBoard): Promise<void> => {
    await ports.cache.write(remote).catch(() => undefined);
    show({
      board: remote.payload,
      revision: remote.revision,
      status: 'ready',
    });
  };

  const load = async (): Promise<ConflictCopy> => {
    const cached = await ports.cache.read();
    const current = record();

    if (
      cached !== null &&
      current.conflict !== null &&
      cached.revision === current.conflict
    ) {
      return {
        board: cached.payload,
        revision: cached.revision,
        status: 'ready',
      };
    }

    if (!signedIn()) {
      return { status: 'offline' };
    }

    let downloaded: DownloadedBoard | null;
    try {
      downloaded = await transport.download(boardId);
    } catch {
      downloaded = null;
    }

    if (downloaded === null) {
      return { status: 'offline' };
    }

    await ports.cache.write(downloaded);
    return {
      board: downloaded.payload,
      revision: downloaded.revision,
      status: 'ready',
    };
  };

  const open = async (): Promise<void> => {
    if (record().conflict === null || opening) {
      return;
    }
    if (copy?.status === 'ready') {
      return;
    }
    opening = true;
    try {
      show({ status: 'loading' });
      show(await load());
    } catch {
      show({ status: 'offline' });
    } finally {
      opening = false;
    }
  };

  const applyRemote = async (remote: {
    board: Board;
    revision: number;
  }): Promise<Board | null> => {
    try {
      const replaced = await ports.replaceLocal(remote.board);
      ports.adoptLocal(remote.board);
      setRecord({
        conflict: null,
        linked: true,
        revision: remote.revision,
        tooLarge: false,
      });
      await ports.cache.clear().catch(() => undefined);
      show(null);
      setState(
        signedIn()
          ? { revision: remote.revision, status: 'synced' }
          : { status: 'signed-out' }
      );
      return replaced;
    } catch {
      setState(conflictState(record().revision ?? 0, record().conflict ?? 0));
      return null;
    }
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
    } catch {
      setState(conflictState(current.revision ?? 0, current.conflict));
      return false;
    }

    if (result.kind === 'accepted') {
      setRecord({
        conflict: null,
        linked: true,
        revision: result.revision,
        tooLarge: false,
      });
      await ports.cache.clear().catch(() => undefined);
      show(null);
      setState({ revision: result.revision, status: 'synced' });
      return true;
    }

    if (result.kind === 'conflict') {
      setRecord({ ...record(), conflict: result.revision });
      if (result.payload !== null) {
        await remember({
          payload: result.payload,
          revision: result.revision,
        });
      }
      setState(conflictState(current.conflict, result.revision));
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
    const current = record();
    if (current.conflict === null) {
      return null;
    }

    let ready = readyCopy();
    if (ready === null) {
      await open();
      ready = readyCopy();
    }
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

    const duplicated = await ports
      .duplicateLocal(local.board)
      .catch(() => null);
    if (duplicated === null) {
      return false;
    }

    setState({ revision: 0, status: 'syncing' });

    let result: UploadResult;
    try {
      result = await transport.upload({
        baseRevision: null,
        id: duplicated.id,
        payload: duplicated.board,
        preview: local.preview,
      });
    } catch {
      setState(conflictState(current.revision ?? 0, current.conflict));
      return false;
    }

    if (result.kind !== 'accepted') {
      setState(conflictState(current.revision ?? 0, current.conflict));
      return false;
    }

    await ports
      .saveRecordFor(duplicated.id, {
        conflict: null,
        linked: true,
        revision: result.revision,
        tooLarge: false,
      })
      .catch(() => undefined);

    let ready = readyCopy();
    if (ready === null) {
      await open();
      ready = readyCopy();
    }
    if (ready !== null) {
      const replaced = await applyRemote({
        board: ready.board,
        revision: ready.revision,
      });
      return replaced !== null;
    }

    return false;
  };

  return {
    duplicateMine,
    getCopy: () => copy,
    keepMine,
    open,
    remember,
    takeTheirs,
  };
};
