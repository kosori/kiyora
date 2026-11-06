import type { Board } from '@kiyora/model';
import type { SyncRecord } from './reconcile';
import type { DownloadedBoard, SyncTransport } from './transport';

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

/** A copy that is loaded and safe to apply. */
export type ReadyCopy = Extract<ConflictCopy, { status: 'ready' }>;

export type ConflictCopyDeps = {
  boardId: string;
  transport: SyncTransport;
  cache: ConflictCache;
  record: () => SyncRecord;
  signedIn: () => boolean;
  publish: () => void;
};

/** The remote copy held beside a conflict, and the one way to load it. */
export type ConflictCopyController = {
  getCopy: () => ConflictCopy | null;
  /** Loads the remote copy from the cache, or fetches it when none is cached. */
  open: () => Promise<void>;
  /** Caches a remote copy a refused write carried, and shows it. */
  remember: (remote: DownloadedBoard) => Promise<void>;
  /** Drops the cached copy after a refusal carried no payload. */
  forget: () => Promise<void>;
  /** A copy at or past the recorded conflict revision, loading one when needed. */
  ensureReadyCopy: () => Promise<ReadyCopy | null>;
};

const sameCopy = (
  left: ConflictCopy | null,
  right: ConflictCopy | null
): boolean => {
  if (left === null || right === null) {
    return left === right;
  }
  if (left.status !== right.status) {
    return false;
  }
  if (left.status !== 'ready' || right.status !== 'ready') {
    return true;
  }
  return left.revision === right.revision && left.board === right.board;
};

export const createConflictCopy = ({
  boardId,
  transport,
  cache,
  record,
  signedIn,
  publish,
}: ConflictCopyDeps): ConflictCopyController => {
  let copy: ConflictCopy | null = null;
  let opening: Promise<void> | null = null;

  const show = (next: ConflictCopy | null): void => {
    if (sameCopy(copy, next)) {
      return;
    }
    copy = next;
    publish();
  };

  const readyCopy = (): ReadyCopy | null =>
    copy?.status === 'ready' ? copy : null;

  const remember = async (remote: DownloadedBoard): Promise<void> => {
    await cache.write(remote).catch(() => undefined);
    show({
      board: remote.payload,
      revision: remote.revision,
      status: 'ready',
    });
  };

  const load = async (): Promise<ConflictCopy> => {
    const cached = await cache.read();
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

    await cache.write(downloaded).catch(() => undefined);
    return {
      board: downloaded.payload,
      revision: downloaded.revision,
      status: 'ready',
    };
  };

  const open = (): Promise<void> => {
    if (record().conflict === null || copy?.status === 'ready') {
      return Promise.resolve();
    }
    if (opening !== null) {
      return opening;
    }
    opening = (async () => {
      try {
        show({ status: 'loading' });
        show(await load());
      } catch {
        show({ status: 'offline' });
      } finally {
        opening = null;
      }
    })();
    return opening;
  };

  const forget = async (): Promise<void> => {
    await cache.clear().catch(() => undefined);
    show(null);
  };

  const ensureReadyCopy = async (): Promise<ReadyCopy | null> => {
    const current = record();
    if (current.conflict === null) {
      return null;
    }

    let ready = readyCopy();
    if (ready !== null && ready.revision < current.conflict) {
      await forget();
      ready = null;
    }

    if (ready === null) {
      await open();
      ready = readyCopy();
    }

    return ready !== null && ready.revision >= current.conflict ? ready : null;
  };

  return {
    ensureReadyCopy,
    forget,
    getCopy: () => copy,
    open,
    remember,
  };
};
