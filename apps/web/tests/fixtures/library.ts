import {
  boardConflictKey,
  boardKey,
  boardQuarantineKey,
  boardSnapshotKey,
  LEGACY_BOARD_KEY,
  LEGACY_QUARANTINE_KEY,
  LEGACY_SNAPSHOT_KEY,
  LIBRARY_KEY,
} from '@kiyora/editor';
import { type Board, parseBoard } from '@kiyora/model';
import { expect, type Page } from '@playwright/test';
import { STARTER_PATH, starterBoard } from './starter-board';

/** The IndexedDB database the web adapter opens. */
export const DATABASE = 'kiyora';

/** Its version, which the upgrade test raises by seeding the legacy keys at 1. */
export const DATABASE_VERSION = 2;

/** The object store every library key lives in. */
export const BOARD_STORE = 'boards';

/** One board the helper can seed, before the bytes carry the schema's defaults. */
export type SeededBoard = {
  id: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  camera?: { x: number; y: number; zoom: number };
  deck?: unknown[];
  files?: Record<string, unknown>;
  schemaVersion?: number;
  settings?: { theme: string };
  shapes?: unknown[];
  /** What the library record says about the board's remote copy. */
  sync?: {
    linked?: boolean;
    revision?: number;
    pending?: boolean;
    conflict?: number;
    tooLarge?: boolean;
  };
  /** The picture the record lists, when the spec seeds one. */
  preview?: string;
};

export type SeedStorage = 'indexeddb' | 'local';

export type SeedOptions = {
  /** Which store the app should find the board in. Defaults to IndexedDB. */
  storage?: SeedStorage;
  /** Where to navigate once the bytes are in place. Defaults to the first board. */
  open?: string;
  /** Whether to write `kiyora:library`. Defaults to true. */
  record?: boolean;
  /** Extra keys written last, for bytes that are not a board. */
  raw?: Record<string, string>;
  /** Bytes for the single board key v1.5 used, seeded for the upgrade test. */
  legacy?: string;
  legacySnapshot?: string;
  legacyQuarantine?: string;
  /** What to wait for after navigating. Defaults from the address. */
  waitFor?: 'canvas' | 'library' | 'none';
  /** How long to wait for that surface. Defaults to the suite's expect timeout. */
  timeout?: number;
};

const SENTINEL = '/__kiyora_seed__';

const bytesOf = (board: SeededBoard): string => {
  const { preview, sync, ...payload } = board;

  return JSON.stringify({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    files: {},
    schemaVersion: 3,
    settings: { theme: 'light' },
    shapes: [],
    title: 'Untitled',
    updatedAt: 1_700_000_000_000,
    ...payload,
  });
};

/** A seeded board as the bytes of a `.kyr.json` file. */
export const boardFileBytes = (board: SeededBoard): string => bytesOf(board);

/** One seeded board as the full board the app will read. */
export const seededBoard = (board: SeededBoard): Board =>
  parseBoard(JSON.parse(bytesOf(board)));

const entryOf = (board: SeededBoard) => ({
  id: board.id,
  title: board.title ?? 'Untitled',
  updatedAt: board.updatedAt ?? 1_700_000_000_000,
  ...board.sync,
  ...(board.preview === undefined ? {} : { preview: board.preview }),
});

/** The library record's bytes, for a spec that has to keep the payload itself. */
export const libraryRecord = (boards: SeededBoard[]): string =>
  JSON.stringify({
    boards: boards
      .map(entryOf)
      .sort((left, right) => right.updatedAt - left.updatedAt),
    version: 1,
  });

/** The key one board's payload lives under. */
export const boardStorageKey = boardKey;

/** The key one board's quarantine lives under. */
export const quarantineKey = boardQuarantineKey;
export const snapshotKey = boardSnapshotKey;
export const conflictKey = boardConflictKey;

/** The bytes and extra keys a seed writes, in the order the helper writes them. */
export const seedEntries = (
  boards: SeededBoard[],
  { record = true, raw = {} }: Pick<SeedOptions, 'record' | 'raw'>
): [string, string][] => {
  const entries: [string, string][] = [];

  if (record) {
    entries.push([LIBRARY_KEY, libraryRecord(boards)]);
  }
  for (const board of boards) {
    entries.push([boardStorageKey(board.id), bytesOf(board)]);
  }
  for (const [key, value] of Object.entries(raw)) {
    entries.push([key, value]);
  }

  return entries;
};

const writeIndexedDb = async (
  page: Page,
  version: number,
  entries: [string, string][]
): Promise<void> => {
  await page.evaluate(
    async ({ databaseName, databaseVersion, storeName, pairs }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open(databaseName, databaseVersion);
        opening.onupgradeneeded = () => {
          if (!opening.result.objectStoreNames.contains(storeName)) {
            opening.result.createObjectStore(storeName);
          }
        };
        opening.onblocked = () => reject(new Error('indexedDB blocked'));
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
      });

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        for (const [key, value] of pairs) {
          store.put(value, key);
        }
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    {
      databaseName: DATABASE,
      databaseVersion: version,
      pairs: entries,
      storeName: BOARD_STORE,
    }
  );
};

const writeLocalStorage = async (
  page: Page,
  entries: [string, string][],
  legacy: [string, string][]
): Promise<void> => {
  await page.addInitScript(
    ({ pairs, legacyPairs }) => {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: undefined,
      });
      if (sessionStorage.getItem('kiyora:e2e-seeded') === '1') {
        return;
      }
      for (const [key, value] of pairs) {
        localStorage.setItem(key, value);
      }
      for (const [key, value] of legacyPairs) {
        localStorage.setItem(key, value);
      }
      sessionStorage.setItem('kiyora:e2e-seeded', '1');
    },
    { legacyPairs: legacy, pairs: entries }
  );
};

const waitForSurface = async (
  page: Page,
  waitFor: NonNullable<SeedOptions['waitFor']>,
  timeout: number | undefined
): Promise<void> => {
  if (waitFor === 'canvas') {
    await expect(page.getByTestId('canvas')).toHaveAttribute(
      'data-ready',
      'true',
      { timeout }
    );
  }
  if (waitFor === 'library') {
    await expect(page.getByTestId('library')).toBeVisible({ timeout });
  }
};

/**
 * The one way an end-to-end spec puts boards in the browser. It writes each
 * payload under its own key and a library record that names them, then navigates
 * to a board's address (or the library) and waits for that surface to be ready.
 * `legacy` seeds the single board key v1.5 used, so the upgrade can be driven
 * from a database that has never seen the library.
 */
export const seedBoards = async (
  page: Page,
  boards: SeededBoard[] = [],
  options: SeedOptions = {}
): Promise<void> => {
  const open = options.open ?? (boards[0] ? `/b/${boards[0].id}` : '/');
  const waitFor =
    options.waitFor ?? (open.startsWith('/b/') ? 'canvas' : 'library');
  const entries = seedEntries(boards, options);
  const legacy: [string, string][] = [];
  if (options.legacy !== undefined) {
    legacy.push([LEGACY_BOARD_KEY, options.legacy]);
  }
  if (options.legacySnapshot !== undefined) {
    legacy.push([LEGACY_SNAPSHOT_KEY, options.legacySnapshot]);
  }
  if (options.legacyQuarantine !== undefined) {
    legacy.push([LEGACY_QUARANTINE_KEY, options.legacyQuarantine]);
  }

  if (options.storage === 'local') {
    await writeLocalStorage(page, entries, legacy);
    await page.goto(open);
  } else {
    await page.goto(SENTINEL);
    await writeIndexedDb(page, legacy.length === 0 ? DATABASE_VERSION : 1, [
      ...entries,
      ...legacy,
    ]);
    await page.goto(open);
  }

  await waitForSurface(page, waitFor, options.timeout);
};

/** Opens the starter board's own address, seeding the board v1.5 showed. */
export const openStarterBoard = (
  page: Page,
  options: SeedOptions = {}
): Promise<void> =>
  seedBoards(page, [starterBoard()], {
    ...options,
    open: options.open ?? STARTER_PATH,
  });

/** Opens one board, seeding it under the new keys first. */
export const openBoard = (
  page: Page,
  board: SeededBoard,
  options: SeedOptions = {}
): Promise<void> =>
  seedBoards(page, [board], {
    ...options,
    open: options.open ?? `/b/${board.id}`,
  });

/** Opens the library, seeding the boards it should list. */
export const openLibrary = (
  page: Page,
  boards: SeededBoard[] = [],
  options: SeedOptions = {}
): Promise<void> =>
  seedBoards(page, boards, { ...options, open: options.open ?? '/' });

/** Opens a board another tab has already seeded, without writing its bytes again. */
export const openExistingBoard = async (
  page: Page,
  id: string
): Promise<void> => {
  await page.goto(`/b/${id}`);
  await waitForSurface(page, 'canvas', undefined);
};

/** Reads one key's stored bytes through IndexedDB. */
export const readStoredKey = async (
  page: Page,
  key: string
): Promise<string | null> =>
  page.evaluate(
    async ({ databaseName, databaseVersion, storeName, storedKey }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open(databaseName, databaseVersion);
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
      });
      const value = await new Promise<string | null>((resolve, reject) => {
        const request = database
          .transaction(storeName, 'readonly')
          .objectStore(storeName)
          .get(storedKey);
        request.onsuccess = () =>
          resolve((request.result as string | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return value;
    },
    {
      databaseName: DATABASE,
      databaseVersion: DATABASE_VERSION,
      storedKey: key,
      storeName: BOARD_STORE,
    }
  );

/** Writes one key through IndexedDB, for a seed whose bytes the helper would not produce. */
export const writeStoredKey = async (
  page: Page,
  key: string,
  value: string
): Promise<void> =>
  page.evaluate(
    async ({
      databaseName,
      databaseVersion,
      storeName,
      storedKey,
      storedValue,
    }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open(databaseName, databaseVersion);
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).put(storedValue, storedKey);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    {
      databaseName: DATABASE,
      databaseVersion: DATABASE_VERSION,
      storedKey: key,
      storedValue: value,
      storeName: BOARD_STORE,
    }
  );

/** Deletes one key through IndexedDB. */
export const deleteStoredKey = async (page: Page, key: string): Promise<void> =>
  page.evaluate(
    async ({ databaseName, databaseVersion, storeName, storedKey }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open(databaseName, databaseVersion);
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).delete(storedKey);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    {
      databaseName: DATABASE,
      databaseVersion: DATABASE_VERSION,
      storedKey: key,
      storeName: BOARD_STORE,
    }
  );

/** Reads one board's stored bytes through IndexedDB. */
export const readStoredBoard = (
  page: Page,
  id: string
): Promise<string | null> => readStoredKey(page, boardStorageKey(id));
