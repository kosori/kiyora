import { expect, type Page } from '@playwright/test';
import { STARTER_PATH, starterBoard } from './starter-board';

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
    conflict?: number;
    tooLarge?: boolean;
  };
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

const BOARD_PREFIX = 'kiyora:boards:';
const LIBRARY_KEY = 'kiyora:library';
const LEGACY_BOARD_KEY = 'kiyora:board';
const LEGACY_SNAPSHOT_KEY = 'kiyora:board:snapshot';
const LEGACY_QUARANTINE_KEY = 'kiyora:board:quarantine';
const SENTINEL = '/__kiyora_seed__';

const bytesOf = (board: SeededBoard): string => {
  const { sync, ...payload } = board;

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

const entryOf = (board: SeededBoard) => ({
  id: board.id,
  title: board.title ?? 'Untitled',
  updatedAt: board.updatedAt ?? 1_700_000_000_000,
  ...board.sync,
});

/** The key one board's payload lives under. */
export const boardStorageKey = (id: string): string => `${BOARD_PREFIX}${id}`;

/** The key one board's quarantine lives under. */
export const quarantineKey = (id: string): string =>
  `${boardStorageKey(id)}:quarantine`;

/** The bytes and extra keys a seed writes, in the order the helper writes them. */
export const seedEntries = (
  boards: SeededBoard[],
  { record = true, raw = {} }: Pick<SeedOptions, 'record' | 'raw'>
): [string, string][] => {
  const entries: [string, string][] = [];

  if (record) {
    const listed = boards
      .map(entryOf)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    entries.push([LIBRARY_KEY, JSON.stringify({ boards: listed, version: 1 })]);
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
    async ({ databaseVersion, pairs }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open('kiyora', databaseVersion);
        opening.onupgradeneeded = () => {
          if (!opening.result.objectStoreNames.contains('boards')) {
            opening.result.createObjectStore('boards');
          }
        };
        opening.onblocked = () => reject(new Error('indexedDB blocked'));
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error);
      });

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('boards', 'readwrite');
        const store = transaction.objectStore('boards');
        for (const [key, value] of pairs) {
          store.put(value, key);
        }
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    { databaseVersion: version, pairs: entries }
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
    await writeIndexedDb(page, legacy.length === 0 ? 2 : 1, [
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
  page.evaluate(async (storedKey) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open('kiyora', 2);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    const value = await new Promise<string | null>((resolve, reject) => {
      const request = database
        .transaction('boards', 'readonly')
        .objectStore('boards')
        .get(storedKey);
      request.onsuccess = () =>
        resolve((request.result as string | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return value;
  }, key);

/** Reads one board's stored bytes through IndexedDB. */
export const readStoredBoard = (
  page: Page,
  id: string
): Promise<string | null> => readStoredKey(page, boardStorageKey(id));
