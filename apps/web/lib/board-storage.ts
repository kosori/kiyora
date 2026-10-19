import { BOARD_KEY, type BoardStorage } from '@kiyora/editor';

const DATABASE = 'kiyora';
const DATABASE_VERSION = 1;
const STORE = 'boards';
const PROBE_KEY = 'kiyora:probe';

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

  return {
    read: async () =>
      (await run<string | undefined>(
        'readonly',
        (store) =>
          // `IDBObjectStore.get` is typed `any`; the key/value pair is ours.
          store.get(BOARD_KEY) as IDBRequest<string | undefined>
      )) ?? null,
    write: async (value) => {
      await run('readwrite', (store) => store.put(value, BOARD_KEY));
    },
  };
};

const localStorageStorage = (): BoardStorage | null => {
  try {
    localStorage.setItem(PROBE_KEY, '1');
    localStorage.removeItem(PROBE_KEY);
  } catch {
    return null;
  }

  return {
    read: () => Promise.resolve(localStorage.getItem(BOARD_KEY)),
    write: (value) => {
      localStorage.setItem(BOARD_KEY, value);
      return Promise.resolve();
    },
  };
};

const memoryStorage = (): BoardStorage => {
  let held: string | null = null;

  return {
    read: () => Promise.resolve(held),
    write: (value) => {
      held = value;
      return Promise.resolve();
    },
  };
};

/**
 * The board's storage, strongest first: IndexedDB, then localStorage, then
 * memory. A browser that lacks or blocks one falls through to the next, so the
 * editor always has somewhere to write and the indicator can stay honest about
 * whether it did.
 */
export const openBoardStorage = async (): Promise<BoardStorage> => {
  if (typeof indexedDB !== 'undefined') {
    try {
      return await indexedDbStorage();
    } catch {
      // IndexedDB is absent or blocked; localStorage carries the board instead.
    }
  }

  return localStorageStorage() ?? memoryStorage();
};
