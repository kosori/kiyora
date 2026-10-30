import {
  adoptLegacyBoard,
  boardKey,
  boardQuarantineKey,
  boardSnapshotKey,
  type KeyValueStore,
  LEGACY_BOARD_KEY,
  LEGACY_QUARANTINE_KEY,
  LEGACY_SNAPSHOT_KEY,
  LIBRARY_KEY,
  StorageError,
  type StorageFault,
} from '@kiyora/editor';

const DATABASE = 'kiyora';
const DATABASE_VERSION = 2;
const STORE = 'boards';
const PROBE_KEY = 'kiyora:probe';

/** The DOM exception codes that mean "full" and "denied", on older engines. */
const QUOTA_CODE = 22;
const BLOCKED_CODE = 18;

/**
 * The fault a browser exception stands for. This is the one place that knows
 * what a `DOMException` is: below it, the engine only ever sees a typed fault.
 */
export const faultFromException = (error: unknown): StorageFault => {
  const name = error instanceof Error ? error.name : '';
  const code =
    typeof (error as { code?: unknown } | null)?.code === 'number'
      ? (error as { code: number }).code
      : null;

  if (name === 'QuotaExceededError' || code === QUOTA_CODE) {
    return { kind: 'quota' };
  }
  if (
    name === 'SecurityError' ||
    name === 'InvalidStateError' ||
    name === 'NotAllowedError' ||
    code === BLOCKED_CODE
  ) {
    return { kind: 'blocked' };
  }
  return { kind: 'unavailable' };
};

/** Runs a storage call, turning any browser exception into a typed fault. */
const guarded = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    throw new StorageError(faultFromException(error), { cause: error });
  }
};

/** Settles an IndexedDB request as a promise, the shape the storage port wants. */
const settle = <T>(source: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () =>
      reject(source.error ?? new Error('indexedDB request failed'));
  });

const parseRecord = (
  bytes: unknown
): { boards: { id: string; title: string; updatedAt: number }[] } => {
  if (typeof bytes !== 'string') {
    return { boards: [] };
  }
  try {
    const parsed = JSON.parse(bytes) as { boards?: unknown };
    return Array.isArray(parsed.boards)
      ? (parsed as {
          boards: { id: string; title: string; updatedAt: number }[];
        })
      : { boards: [] };
  } catch {
    return { boards: [] };
  }
};

/**
 * Adopts the single board of version 1 inside the version-change transaction.
 * The record is written before the legacy keys are deleted, and the whole
 * transaction rolls back if any request fails, so a board is never lost to a
 * record that could not be written.
 */
const adoptInUpgrade = (store: IDBObjectStore): void => {
  const legacy = store.get(LEGACY_BOARD_KEY);
  legacy.onsuccess = () => {
    const bytes = legacy.result as string | undefined;
    if (typeof bytes !== 'string') {
      return;
    }

    let id: string;
    let title: string;
    let updatedAt: number;
    try {
      const payload = JSON.parse(bytes) as {
        id?: unknown;
        title?: unknown;
        updatedAt?: unknown;
      };
      const { id: storedId } = payload;
      if (typeof storedId !== 'string' || storedId.length === 0) {
        return;
      }
      id = storedId;
      title = typeof payload.title === 'string' ? payload.title : '';
      updatedAt = typeof payload.updatedAt === 'number' ? payload.updatedAt : 0;
    } catch {
      return;
    }

    store.put(bytes, boardKey(id));

    const snapshot = store.get(LEGACY_SNAPSHOT_KEY);
    snapshot.onsuccess = () => {
      if (typeof snapshot.result === 'string') {
        store.put(snapshot.result, boardSnapshotKey(id));
      }
    };
    const quarantine = store.get(LEGACY_QUARANTINE_KEY);
    quarantine.onsuccess = () => {
      if (typeof quarantine.result === 'string') {
        store.put(quarantine.result, boardQuarantineKey(id));
      }
    };

    const record = store.get(LIBRARY_KEY);
    record.onsuccess = () => {
      const boards = [
        ...parseRecord(record.result).boards.filter((board) => board.id !== id),
        { id, title, updatedAt },
      ].sort((left, right) => right.updatedAt - left.updatedAt);

      const written = store.put(
        JSON.stringify({ boards, version: 1 }),
        LIBRARY_KEY
      );
      written.onsuccess = () => {
        store.delete(LEGACY_BOARD_KEY);
        store.delete(LEGACY_SNAPSHOT_KEY);
        store.delete(LEGACY_QUARANTINE_KEY);
      };
    };
  };
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, DATABASE_VERSION);
    opening.onupgradeneeded = () => {
      const store = opening.result.objectStoreNames.contains(STORE)
        ? opening.transaction?.objectStore(STORE)
        : opening.result.createObjectStore(STORE);
      if (store !== undefined && store !== null) {
        adoptInUpgrade(store);
      }
    };
    opening.onblocked = () =>
      reject(new DOMException('blocked', 'InvalidStateError'));
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () =>
      reject(opening.error ?? new Error('indexedDB refused to open'));
  });

const indexedDbStore = async (): Promise<KeyValueStore> => {
  const database = await openDatabase();
  const run = <T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> => {
    const transaction = database.transaction(STORE, mode);
    return settle(work(transaction.objectStore(STORE)));
  };

  return {
    delete: (key) =>
      guarded(async () => {
        await run('readwrite', (store) => store.delete(key));
      }),
    get: (key) =>
      guarded(() =>
        run<string | undefined>('readonly', (store) => store.get(key)).then(
          (value) => value ?? null
        )
      ),
    keys: () =>
      guarded(() =>
        run<IDBValidKey[]>('readonly', (store) => store.getAllKeys()).then(
          (keys) => keys.map(String)
        )
      ),
    put: (key, value) =>
      guarded(async () => {
        await run('readwrite', (store) => store.put(value, key));
      }),
  };
};

const localStorageStore = (): KeyValueStore => ({
  delete: (key) =>
    guarded(() => {
      localStorage.removeItem(key);
      return Promise.resolve();
    }),
  get: (key) => guarded(() => Promise.resolve(localStorage.getItem(key))),
  keys: () =>
    guarded(() =>
      Promise.resolve(
        Object.keys(localStorage).filter((key) => key.startsWith('kiyora:'))
      )
    ),
  put: (key, value) =>
    guarded(() => {
      localStorage.setItem(key, value);
      return Promise.resolve();
    }),
  supportsFiles: false,
});

const memoryStore = (): KeyValueStore => {
  const held = new Map<string, string>();

  return {
    delete: (key) => {
      held.delete(key);
      return Promise.resolve();
    },
    get: (key) => Promise.resolve(held.get(key) ?? null),
    keys: () => Promise.resolve([...held.keys()]),
    put: (key, value) => {
      held.set(key, value);
      return Promise.resolve();
    },
  };
};

/** The library's storage, and the fault standing in the way of a durable save. */
export type OpenedStore = {
  store: KeyValueStore;
  fault: StorageFault | null;
  /** Whether this store loses its boards with the tab (the memory fallback). */
  volatile: boolean;
};

/**
 * The library's storage, strongest first: IndexedDB, then localStorage, then
 * memory. A browser that lacks or blocks one falls through to the next, so the
 * library always has somewhere to write. Only the memory fallback is a fault:
 * the board is usable, but unless the browser unblocks, it will not survive the
 * tab. A fallback that still persists a durable copy is not a failure.
 *
 * The single board of version 1 is adopted as the first library board on the
 * way in, by the IndexedDB upgrade or by the same store-neutral adoption for
 * the localStorage fallback.
 */
export const openStore = async (): Promise<OpenedStore> => {
  let fault: StorageFault | null = null;

  if (typeof indexedDB !== 'undefined') {
    try {
      return { fault: null, store: await indexedDbStore(), volatile: false };
    } catch (error) {
      fault = faultFromException(error);
    }
  }

  try {
    localStorage.setItem(PROBE_KEY, '1');
    localStorage.removeItem(PROBE_KEY);
    const store = localStorageStore();
    try {
      await adoptLegacyBoard(store);
    } catch (error) {
      fault = faultFromException(error);
    }
    return { fault, store, volatile: false };
  } catch (error) {
    return {
      fault: fault ?? faultFromException(error),
      store: memoryStore(),
      volatile: true,
    };
  }
};
