import {
  BOARD_KEY,
  type BoardStorage,
  QUARANTINE_KEY,
  SNAPSHOT_KEY,
  StorageError,
  type StorageFault,
} from '@kiyora/editor';

const DATABASE = 'kiyora';
const DATABASE_VERSION = 1;
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

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, DATABASE_VERSION);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE)) {
        opening.result.createObjectStore(STORE);
      }
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () =>
      reject(opening.error ?? new Error('indexedDB refused to open'));
  });

const indexedDbStorage = async (): Promise<BoardStorage> => {
  const database = await openDatabase();
  const run = <T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> => {
    const transaction = database.transaction(STORE, mode);
    return settle(work(transaction.objectStore(STORE)));
  };
  const read = async (key: string): Promise<string | null> =>
    // `IDBObjectStore.get` is typed `any`; the key/value pair is ours.
    (await run<string | undefined>('readonly', (store) => store.get(key))) ??
    null;
  const put = async (key: string, value: string): Promise<void> => {
    await run('readwrite', (store) => store.put(value, key));
  };
  const remove = async (key: string): Promise<void> => {
    await run('readwrite', (store) => store.delete(key));
  };

  return {
    quarantine: (value) =>
      guarded(async () => {
        await put(QUARANTINE_KEY, value);
        await remove(BOARD_KEY);
      }),
    read: () => guarded(() => read(BOARD_KEY)),
    snapshot: (value) => guarded(() => put(SNAPSHOT_KEY, value)),
    write: (value) => guarded(() => put(BOARD_KEY, value)),
  };
};

const localStorageStorage = (): BoardStorage => ({
  quarantine: (value) =>
    guarded(() => {
      localStorage.setItem(QUARANTINE_KEY, value);
      localStorage.removeItem(BOARD_KEY);
      return Promise.resolve();
    }),
  read: () => guarded(() => Promise.resolve(localStorage.getItem(BOARD_KEY))),
  snapshot: (value) =>
    guarded(() => {
      localStorage.setItem(SNAPSHOT_KEY, value);
      return Promise.resolve();
    }),
  write: (value) =>
    guarded(() => {
      localStorage.setItem(BOARD_KEY, value);
      return Promise.resolve();
    }),
});

const memoryStorage = (): BoardStorage => {
  const held = new Map<string, string>();

  return {
    quarantine: (value) => {
      held.set(QUARANTINE_KEY, value);
      held.delete(BOARD_KEY);
      return Promise.resolve();
    },
    read: () => Promise.resolve(held.get(BOARD_KEY) ?? null),
    snapshot: (value) => {
      held.set(SNAPSHOT_KEY, value);
      return Promise.resolve();
    },
    write: (value) => {
      held.set(BOARD_KEY, value);
      return Promise.resolve();
    },
  };
};

/** The board's storage, and the fault standing in the way of a durable save. */
export type OpenedStorage = {
  storage: BoardStorage;
  fault: StorageFault | null;
};

/**
 * The board's storage, strongest first: IndexedDB, then localStorage, then
 * memory. A browser that lacks or blocks one falls through to the next, so the
 * editor always has somewhere to write. Only the memory fallback is a fault:
 * the board is usable, but unless the browser unblocks, it will not survive the
 * tab. A fallback that still persists a durable copy is not a failure.
 */
export const openBoardStorage = async (): Promise<OpenedStorage> => {
  let fault: StorageFault | null = null;

  if (typeof indexedDB !== 'undefined') {
    try {
      return { fault: null, storage: await indexedDbStorage() };
    } catch (error) {
      fault = faultFromException(error);
    }
  }

  try {
    localStorage.setItem(PROBE_KEY, '1');
    localStorage.removeItem(PROBE_KEY);
    return { fault: null, storage: localStorageStorage() };
  } catch (error) {
    return {
      fault: fault ?? faultFromException(error),
      storage: memoryStorage(),
    };
  }
};
