import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it, vi } from 'vitest';
import type { ConflictPorts } from './conflict-resolution';
import type { SyncRecord, SyncSnapshot, SyncState } from './reconcile';
import { createSyncMachine } from './reconcile';
import type {
  DownloadedBoard,
  SyncTransport,
  UploadRequest,
  UploadResult,
} from './transport';

const board = (overrides: Record<string, unknown> = {}): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [],
    title: 'Mine',
    updatedAt: 1_700_000_000_000,
    ...overrides,
  });

const copyBoard = (title: string): Board => board({ title });

const snapshot = (value: Board = board()): SyncSnapshot => ({
  board: value,
  bytes: JSON.stringify(value),
  preview: '<svg></svg>',
});

const conflicted = (): SyncRecord => ({
  conflict: 7,
  linked: true,
  pending: false,
  revision: 2,
  tooLarge: false,
});

type Ports = ConflictPorts & {
  cache: {
    read: ReturnType<typeof vi.fn<() => Promise<DownloadedBoard | null>>>;
    write: ReturnType<typeof vi.fn<(copy: DownloadedBoard) => Promise<void>>>;
    clear: ReturnType<typeof vi.fn<() => Promise<void>>>;
  };
  replaceLocal: ReturnType<typeof vi.fn<(remote: Board) => Promise<Board>>>;
  duplicateLocal: ReturnType<
    typeof vi.fn<(local: Board) => Promise<{ id: string; board: Board } | null>>
  >;
  discardLocal: ReturnType<typeof vi.fn<(id: string) => Promise<void>>>;
  saveRecordFor: ReturnType<
    typeof vi.fn<(id: string, record: SyncRecord) => Promise<void>>
  >;
  adoptLocal: ReturnType<typeof vi.fn<(next: Board) => void>>;
};

const ports = (
  cached: DownloadedBoard | null = null,
  local: Board = board()
): Ports => ({
  adoptLocal: vi.fn<(next: Board) => void>(),
  cache: {
    clear: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    read: vi
      .fn<() => Promise<DownloadedBoard | null>>()
      .mockResolvedValue(cached),
    write: vi
      .fn<(copy: DownloadedBoard) => Promise<void>>()
      .mockResolvedValue(undefined),
  },
  discardLocal: vi
    .fn<(id: string) => Promise<void>>()
    .mockResolvedValue(undefined),
  duplicateLocal: vi
    .fn<(local: Board) => Promise<{ id: string; board: Board } | null>>()
    .mockResolvedValue({ board: copyBoard('Mine copy'), id: 'copy-1' }),
  replaceLocal: vi
    .fn<(remote: Board) => Promise<Board>>()
    .mockResolvedValue(local),
  saveRecordFor: vi
    .fn<(id: string, record: SyncRecord) => Promise<void>>()
    .mockResolvedValue(undefined),
});

type Fake = {
  transport: SyncTransport;
  uploads: UploadRequest[];
  reply: (result: UploadResult) => void;
  downloads: string[];
  downloaded: DownloadedBoard | null;
};

const fakeTransport = (): Fake => {
  const uploads: UploadRequest[] = [];
  const replies: UploadResult[] = [];
  const downloads: string[] = [];
  const fake: Fake = {
    downloaded: null,
    downloads,
    reply: (result) => {
      replies.push(result);
    },
    transport: {
      download: (id) => {
        downloads.push(id);
        return Promise.resolve(fake.downloaded);
      },
      list: async () => ({ boards: [], status: 'ok', total: 0 }),
      remove: () => Promise.resolve({ kind: 'removed' }),
      upload: (request) => {
        uploads.push(request);
        return Promise.resolve(
          replies.shift() ?? { kind: 'accepted', revision: 3 }
        );
      },
    },
    uploads,
  };
  return fake;
};

const machineOf = (
  fake: Fake,
  conflictPorts: ConflictPorts,
  overrides: {
    record?: SyncRecord;
    saved?: SyncRecord[];
    read?: () => SyncSnapshot;
    signedIn?: boolean;
  } = {}
) =>
  createSyncMachine({
    boardId: 'board-1',
    conflict: conflictPorts,
    read: overrides.read ?? (() => snapshot()),
    record: overrides.record ?? conflicted(),
    saveRecord: (record) => overrides.saved?.push(record),
    signedIn: overrides.signedIn ?? true,
    transport: fake.transport,
  });

const ready = (remote: DownloadedBoard) => ({
  board: remote.payload,
  revision: remote.revision,
  status: 'ready',
});

describe('opening a conflict', () => {
  it('uses the cached remote copy without downloading it again', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs'), revision: 7 };
    const conflictPorts = ports(remote);

    const machine = machineOf(fake, conflictPorts);
    await machine.conflict.open();

    expect(fake.downloads).toEqual([]);
    expect(machine.conflict.getCopy()).toEqual(ready(remote));
  });

  it('downloads and caches the remote copy when no cache exists', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs'), revision: 7 };
    fake.downloaded = remote;
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts);
    await machine.conflict.open();

    expect(fake.downloads).toEqual(['board-1']);
    expect(conflictPorts.cache.write).toHaveBeenCalledWith(remote);
    expect(machine.conflict.getCopy()).toEqual(ready(remote));
  });

  it('goes offline without a copy and keeps the conflict', async () => {
    const fake = fakeTransport();
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts);
    await machine.conflict.open();

    expect(machine.conflict.getCopy()).toEqual({ status: 'offline' });
    expect(machine.getState()).toEqual({
      local: 2,
      remote: 7,
      status: 'conflict',
    });
  });

  it('fetches nothing while signed out', async () => {
    const fake = fakeTransport();
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts, { signedIn: false });
    await machine.conflict.open();

    expect(fake.downloads).toEqual([]);
    expect(machine.conflict.getCopy()).toEqual({ status: 'offline' });
  });

  it('shows the copy the refused write carried', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs'), revision: 7 };
    fake.reply({ kind: 'conflict', payload: remote.payload, revision: 7 });
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts, {
      record: { ...conflicted(), conflict: null },
    });
    await machine.reconcile();

    expect(conflictPorts.cache.write).toHaveBeenCalledWith(remote);
    expect(machine.conflict.getCopy()).toEqual(ready(remote));
  });
});

describe('a resolution racing a load', () => {
  it('waits for the load already in flight instead of bailing out', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs'), revision: 7 };
    fake.downloaded = remote;
    const conflictPorts = ports();
    let release: ((copy: DownloadedBoard | null) => void) | undefined;
    conflictPorts.cache.read.mockImplementation(
      () =>
        new Promise<DownloadedBoard | null>((resolve) => {
          release = resolve;
        })
    );
    const machine = machineOf(fake, conflictPorts);

    const opening = machine.conflict.open();
    const taking = machine.conflict.takeTheirs();
    release?.(null);
    await Promise.all([opening, taking]);

    expect(conflictPorts.replaceLocal).toHaveBeenCalledWith(remote.payload);
  });

  it('does not republish a copy it already shows', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs'), revision: 7 };
    const machine = machineOf(fake, ports(remote));
    await machine.conflict.open();

    const seen: SyncState[] = [];
    machine.subscribe(() => seen.push(machine.getState()));
    await machine.conflict.open();

    expect(seen).toEqual([]);
  });
});

describe('conflict notifications', () => {
  it('wakes subscribers when the remote copy arrives', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs'), revision: 7 };
    fake.downloaded = remote;
    const machine = machineOf(fake, ports());
    const seen: SyncState[] = [];
    machine.subscribe(() => seen.push(machine.getState()));

    await machine.conflict.open();

    expect(seen.length).toBeGreaterThan(0);
  });
});
