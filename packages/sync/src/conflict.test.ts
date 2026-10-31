import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it, vi } from 'vitest';
import type { ConflictPorts } from './conflict';
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
      list: () => Promise.resolve([]),
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

const ready = (remote: DownloadedBoard) =>
  ({
    board: remote.payload,
    revision: remote.revision,
    status: 'ready',
  }) as const;

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

describe('keep mine', () => {
  it('uploads the local bytes at the remote revision and clears the conflict', async () => {
    const fake = fakeTransport();
    fake.reply({ kind: 'accepted', revision: 8 });
    const local = board({ title: 'Mine' });
    const conflictPorts = ports(null, local);
    const saved: SyncRecord[] = [];

    const machine = machineOf(fake, conflictPorts, {
      read: () => snapshot(local),
      saved,
    });
    await machine.conflict.keepMine();

    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0]?.baseRevision).toBe(7);
    expect(fake.uploads[0]?.payload).toEqual(local);
    expect(machine.getState()).toEqual({ revision: 8, status: 'synced' });
    expect(saved.at(-1)).toEqual({
      conflict: null,
      linked: true,
      pending: false,
      revision: 8,
      tooLarge: false,
    });
    expect(conflictPorts.cache.clear).toHaveBeenCalled();
  });

  it('leaves the conflict in place when the upload fails', async () => {
    const fake = fakeTransport();
    fake.reply({ kind: 'network' });
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts);
    await machine.conflict.keepMine();

    expect(machine.getState()).toEqual({
      local: 2,
      remote: 7,
      status: 'conflict',
    });
    expect(conflictPorts.cache.clear).not.toHaveBeenCalled();
  });

  it('records a second conflict instead of repeating the upload', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs again'), revision: 9 };
    fake.reply({
      kind: 'conflict',
      payload: remote.payload,
      revision: 9,
    });
    const saved: SyncRecord[] = [];
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts, { saved });
    await machine.conflict.keepMine();

    expect(fake.uploads).toHaveLength(1);
    expect(machine.getState()).toEqual({
      local: 7,
      remote: 9,
      status: 'conflict',
    });
    expect(saved.at(-1)).toEqual({
      conflict: 9,
      linked: true,
      pending: false,
      revision: 2,
      tooLarge: false,
    });
    expect(conflictPorts.cache.write).toHaveBeenCalledWith(remote);
    expect(machine.conflict.getCopy()).toEqual(ready(remote));
  });

  it('sends nothing while signed out', async () => {
    const fake = fakeTransport();
    const machine = machineOf(fake, ports(), { signedIn: false });

    await machine.conflict.keepMine();

    expect(fake.uploads).toEqual([]);
    expect(machine.getState()).toEqual({ status: 'signed-out' });
  });
});

describe('take theirs', () => {
  it('replaces the local copy and hands back the bytes it replaced', async () => {
    const fake = fakeTransport();
    const theirs = copyBoard('Theirs');
    const mine = board({ title: 'Mine' });
    const remote = { payload: theirs, revision: 7 };
    const conflictPorts = ports(remote, mine);
    const saved: SyncRecord[] = [];

    const machine = machineOf(fake, conflictPorts, { saved });
    const replaced = await machine.conflict.takeTheirs();

    expect(conflictPorts.replaceLocal).toHaveBeenCalledWith(theirs);
    expect(conflictPorts.adoptLocal).toHaveBeenCalledWith(theirs);
    expect(replaced).toEqual(mine);
    expect(machine.getState()).toEqual({ revision: 7, status: 'synced' });
    expect(saved.at(-1)).toEqual({
      conflict: null,
      linked: true,
      pending: false,
      revision: 7,
      tooLarge: false,
    });
    expect(conflictPorts.cache.read).toHaveBeenCalled();
    expect(conflictPorts.cache.clear).toHaveBeenCalled();
  });

  it('downloads before replacing when no copy is cached', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs'), revision: 7 };
    fake.downloaded = remote;
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts);
    const replaced = await machine.conflict.takeTheirs();

    expect(fake.downloads).toEqual(['board-1']);
    expect(conflictPorts.replaceLocal).toHaveBeenCalledWith(remote.payload);
    expect(replaced).toEqual(board());
  });

  it('keeps the conflict when no copy can be fetched', async () => {
    const fake = fakeTransport();
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts);
    const replaced = await machine.conflict.takeTheirs();

    expect(replaced).toBeNull();
    expect(conflictPorts.replaceLocal).not.toHaveBeenCalled();
    expect(machine.getState()).toMatchObject({ status: 'conflict' });
  });
});

describe('duplicate mine', () => {
  it('uploads the local bytes as a new board, then takes the remote copy', async () => {
    const fake = fakeTransport();
    const theirs = copyBoard('Theirs');
    const remote = { payload: theirs, revision: 7 };
    const mine = board({ title: 'Mine' });
    const duplicate = { board: copyBoard('Mine copy'), id: 'copy-1' };
    fake.reply({ kind: 'accepted', revision: 1 });
    const conflictPorts = ports(remote, mine);
    conflictPorts.duplicateLocal.mockResolvedValue(duplicate);
    const saved: SyncRecord[] = [];

    const machine = machineOf(fake, conflictPorts, {
      read: () => snapshot(mine),
      saved,
    });
    await machine.conflict.duplicateMine();

    expect(conflictPorts.duplicateLocal).toHaveBeenCalledWith(mine);
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0]?.id).toBe('copy-1');
    expect(fake.uploads[0]?.baseRevision).toBeNull();
    expect(fake.uploads[0]?.payload).toEqual(duplicate.board);
    expect(conflictPorts.saveRecordFor).toHaveBeenCalledWith('copy-1', {
      conflict: null,
      linked: true,
      pending: false,
      revision: 1,
      tooLarge: false,
    });
    expect(conflictPorts.replaceLocal).toHaveBeenCalledWith(theirs);
    expect(conflictPorts.adoptLocal).toHaveBeenCalledWith(theirs);
    expect(saved.at(-1)).toEqual({
      conflict: null,
      linked: true,
      pending: false,
      revision: 7,
      tooLarge: false,
    });
    expect(machine.getState()).toEqual({ revision: 7, status: 'synced' });
  });

  it('leaves the original alone when uploading the copy fails', async () => {
    const fake = fakeTransport();
    fake.reply({ kind: 'network' });
    const conflictPorts = ports();

    const machine = machineOf(fake, conflictPorts);
    await machine.conflict.duplicateMine();

    expect(conflictPorts.replaceLocal).not.toHaveBeenCalled();
    expect(conflictPorts.saveRecordFor).not.toHaveBeenCalled();
    expect(machine.getState()).toMatchObject({ status: 'conflict' });
  });

  it('sends nothing while signed out', async () => {
    const fake = fakeTransport();
    const conflictPorts = ports();
    const machine = machineOf(fake, conflictPorts, { signedIn: false });

    await machine.conflict.duplicateMine();

    expect(fake.uploads).toEqual([]);
    expect(conflictPorts.duplicateLocal).not.toHaveBeenCalled();
    expect(machine.getState()).toEqual({ status: 'signed-out' });
  });
});

const states = (machine: ReturnType<typeof machineOf>): SyncState[] => {
  const seen: SyncState[] = [];
  machine.subscribe(() => seen.push(machine.getState()));
  return seen;
};

describe('conflict notifications', () => {
  it('wakes subscribers when the remote copy arrives', async () => {
    const fake = fakeTransport();
    const remote = { payload: copyBoard('Theirs'), revision: 7 };
    fake.downloaded = remote;
    const machine = machineOf(fake, ports());
    const seen = states(machine);

    await machine.conflict.open();

    expect(seen.length).toBeGreaterThan(0);
  });
});
