import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it, vi } from 'vitest';
import type { SyncRecord, SyncSnapshot, SyncState } from './reconcile';
import { createSyncMachine } from './reconcile';
import type { SyncTransport, UploadRequest, UploadResult } from './transport';

const board = (overrides: Record<string, unknown> = {}): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [],
    title: 'Board',
    updatedAt: 1_700_000_000_000,
    ...overrides,
  });

const snapshot = (
  bytes = '{"board":1}',
  preview: string | null = null
): SyncSnapshot => ({
  board: board(),
  bytes,
  preview,
});

const unlinked: SyncRecord = {
  conflict: null,
  linked: false,
  revision: null,
  tooLarge: false,
};

const linkedAt = (revision: number): SyncRecord => ({
  conflict: null,
  linked: true,
  revision,
  tooLarge: false,
});

type Fake = {
  transport: SyncTransport;
  uploads: UploadRequest[];
  reply: (result: UploadResult) => void;
  hold: () => void;
  release: (result: UploadResult) => void;
  mostAtOnce: () => number;
};

const fakeTransport = (): Fake => {
  const uploads: UploadRequest[] = [];
  const replies: UploadResult[] = [];
  const waiting: ((result: UploadResult) => void)[] = [];
  let active = 0;
  let most = 0;
  let held = false;

  return {
    hold: () => {
      held = true;
    },
    mostAtOnce: () => most,
    release: (result) => {
      held = false;
      for (const settle of waiting.splice(0)) {
        settle(result);
      }
    },
    reply: (result) => {
      replies.push(result);
    },
    transport: {
      download: () => Promise.resolve(null),
      list: () => Promise.resolve([]),
      remove: () => Promise.resolve({ kind: 'removed' }),
      upload: async (request) => {
        uploads.push(request);
        active += 1;
        most = Math.max(most, active);
        try {
          if (held) {
            return await new Promise<UploadResult>((settle) => {
              waiting.push(settle);
            });
          }
          return replies.shift() ?? { kind: 'accepted', revision: 1 };
        } finally {
          active -= 1;
        }
      },
    },
    uploads,
  };
};

const expected = <T>(value: T): T => value;

describe('the sync state machine', () => {
  it('starts local when the board is not linked', () => {
    const fake = fakeTransport();
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: unlinked,
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    expect(machine.getState()).toEqual(expected({ status: 'local' }));
  });

  it('starts synced at the recorded revision of a linked board', () => {
    const fake = fakeTransport();
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: linkedAt(4),
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    expect(machine.getState()).toEqual(
      expected({ revision: 4, status: 'synced' })
    );
  });

  it('links with a null base revision and records revision 1', async () => {
    const fake = fakeTransport();
    const saved: SyncRecord[] = [];
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(undefined, '<svg></svg>'),
      record: unlinked,
      saveRecord: (record) => saved.push(record),
      signedIn: true,
      transport: fake.transport,
    });

    await machine.link();

    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0]?.baseRevision).toBeNull();
    expect(fake.uploads[0]?.payload.id).toBe('board-1');
    expect(fake.uploads[0]?.preview).toBe('<svg></svg>');
    expect(machine.getState()).toEqual(
      expected({ revision: 1, status: 'synced' })
    );
    expect(machine.isLinked()).toBe(true);
    expect(saved.at(-1)).toEqual(linkedAt(1));
  });

  it('refuses to link while signed out and sends nothing', async () => {
    const fake = fakeTransport();
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: unlinked,
      saveRecord: () => undefined,
      signedIn: false,
      transport: fake.transport,
    });

    await machine.link();

    expect(fake.uploads).toEqual([]);
    expect(machine.getState()).toEqual(expected({ status: 'signed-out' }));
    expect(machine.isLinked()).toBe(false);
  });

  it('moves a later save through pending to synced at the next revision', async () => {
    const fake = fakeTransport();
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: linkedAt(1),
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    machine.markPending();
    expect(machine.getState()).toEqual(
      expected({ revision: 1, status: 'pending' })
    );

    fake.hold();
    const uploading = machine.reconcile();
    expect(machine.getState()).toEqual(
      expected({ revision: 1, status: 'syncing' })
    );

    fake.release({ kind: 'accepted', revision: 2 });
    await uploading;

    expect(fake.uploads[0]?.baseRevision).toBe(1);
    expect(machine.getState()).toEqual(
      expected({ revision: 2, status: 'synced' })
    );
  });

  it('records a stale write as a conflict with the remote revision', async () => {
    const fake = fakeTransport();
    const saved: SyncRecord[] = [];
    fake.reply({ kind: 'conflict', payload: board(), revision: 7 });
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: linkedAt(2),
      saveRecord: (record) => saved.push(record),
      signedIn: true,
      transport: fake.transport,
    });

    machine.markPending();
    await machine.reconcile();

    expect(fake.uploads[0]?.baseRevision).toBe(2);
    expect(machine.getState()).toEqual(
      expected({ local: 2, remote: 7, status: 'conflict' })
    );
    expect(saved.at(-1)).toEqual({
      conflict: 7,
      linked: true,
      revision: 2,
      tooLarge: false,
    });
  });

  it('keeps a recorded conflict instead of overwriting it with another save', async () => {
    const fake = fakeTransport();
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: { ...linkedAt(2), conflict: 7 },
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    machine.markPending();
    await machine.reconcile();

    expect(fake.uploads).toEqual([]);
    expect(machine.getState()).toEqual(
      expected({ local: 2, remote: 7, status: 'conflict' })
    );
  });

  it('refuses a board over the limit before sending it', async () => {
    const fake = fakeTransport();
    const machine = createSyncMachine({
      boardId: 'board-1',
      limit: 10,
      read: () => snapshot('x'.repeat(11)),
      record: linkedAt(1),
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    await machine.reconcile();

    expect(fake.uploads).toEqual([]);
    expect(machine.getState()).toEqual(
      expected({ bytes: 11, limit: 10, status: 'too-large' })
    );
  });

  it('becomes too large when a save grows past the limit', () => {
    const fake = fakeTransport();
    let bytes = 'x';
    const machine = createSyncMachine({
      boardId: 'board-1',
      limit: 10,
      read: () => snapshot(bytes),
      record: linkedAt(1),
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    bytes = 'x'.repeat(11);
    machine.markPending();

    expect(machine.getState()).toEqual(
      expected({ bytes: 11, limit: 10, status: 'too-large' })
    );
  });

  it('shows an expired session as unauthorized without retrying by itself', async () => {
    const fake = fakeTransport();
    fake.reply({ kind: 'unauthorized' });
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: linkedAt(1),
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    machine.markPending();
    await machine.reconcile();

    expect(machine.getState()).toEqual(
      expected({ reason: 'unauthorized', status: 'error' })
    );

    await machine.reconcile();
    expect(fake.uploads).toHaveLength(1);
  });

  it('shows a network failure as an error the next reconcile can retry', async () => {
    const fake = fakeTransport();
    fake.reply({ kind: 'network' });
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: linkedAt(1),
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    machine.markPending();
    await machine.reconcile();
    expect(machine.getState()).toEqual(
      expected({ reason: 'network', status: 'error' })
    );

    fake.reply({ kind: 'accepted', revision: 2 });
    await machine.reconcile();
    expect(machine.getState()).toEqual(
      expected({ revision: 2, status: 'synced' })
    );
  });

  it('runs one upload at a time and sends the latest after a save mid-flight', async () => {
    const fake = fakeTransport();
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: linkedAt(1),
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });

    fake.hold();
    const first = machine.reconcile();
    const second = machine.reconcile();
    expect(fake.mostAtOnce()).toBe(1);
    expect(fake.uploads).toHaveLength(1);

    fake.reply({ kind: 'accepted', revision: 3 });
    fake.release({ kind: 'accepted', revision: 2 });
    await first;
    await second;

    await vi.waitFor(() => expect(fake.uploads).toHaveLength(2));
    expect(fake.uploads[1]?.baseRevision).toBe(2);
    expect(fake.mostAtOnce()).toBe(1);
    expect(machine.getState()).toEqual(
      expected({ revision: 3, status: 'synced' })
    );
  });

  it('notifies subscribers when the state moves', async () => {
    const fake = fakeTransport();
    const machine = createSyncMachine({
      boardId: 'board-1',
      read: () => snapshot(),
      record: linkedAt(1),
      saveRecord: () => undefined,
      signedIn: true,
      transport: fake.transport,
    });
    const seen: SyncState[] = [];
    const stop = machine.subscribe(() => seen.push(machine.getState()));

    machine.markPending();
    await machine.reconcile();
    stop();

    expect(seen.map((state) => state.status)).toContain('pending');
    expect(seen.map((state) => state.status)).toContain('synced');
  });
});
