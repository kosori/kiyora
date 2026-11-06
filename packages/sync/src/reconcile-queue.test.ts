import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';
import type { ConflictPorts } from './conflict-resolution';
import type { SyncRecord, SyncSnapshot } from './reconcile';
import { createSyncMachine } from './reconcile';
import type { SyncTransport, UploadResult } from './transport';

const conflictPorts = (): ConflictPorts => ({
  adoptLocal: () => undefined,
  cache: {
    clear: () => Promise.resolve(),
    read: () => Promise.resolve(null),
    write: () => Promise.resolve(),
  },
  discardLocal: () => Promise.resolve(),
  duplicateLocal: () => Promise.resolve(null),
  replaceLocal: (remote) => Promise.resolve(remote),
  saveRecordFor: () => Promise.resolve(),
});

const board = (): Board =>
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
  });

const snapshot = (): SyncSnapshot => ({
  board: board(),
  bytes: '{"board":1}',
  preview: null,
});

const unlinked: SyncRecord = {
  conflict: null,
  linked: false,
  pending: false,
  revision: null,
  tooLarge: false,
};

type Fake = {
  transport: SyncTransport;
  uploads: number;
  hold: () => void;
  release: (result: UploadResult) => void;
};

const fakeTransport = (): Fake => {
  const waiting: ((result: UploadResult) => void)[] = [];
  const fake: Fake = {
    hold: () => {
      held = true;
    },
    release: (result) => {
      held = false;
      for (const settle of waiting.splice(0)) {
        settle(result);
      }
    },
    transport: {
      download: () => Promise.resolve(null),
      list: () => Promise.resolve([]),
      remove: () => Promise.resolve({ kind: 'removed' }),
      upload: async () => {
        fake.uploads += 1;
        if (held) {
          return await new Promise<UploadResult>((settle) => {
            waiting.push(settle);
          });
        }
        return { kind: 'accepted', revision: 1 };
      },
    },
    uploads: 0,
  };
  let held = false;
  return fake;
};

const machineWith = (fake: Fake) =>
  createSyncMachine({
    boardId: 'board-1',
    conflict: conflictPorts(),
    read: snapshot,
    record: unlinked,
    saveRecord: () => undefined,
    signedIn: true,
    transport: fake.transport,
  });

describe('queued sync work', () => {
  it('coalesces a repeated link while one is in flight', async () => {
    const fake = fakeTransport();
    const machine = machineWith(fake);

    fake.hold();
    const first = machine.link();
    const second = machine.link();
    expect(fake.uploads).toBe(1);

    fake.release({ kind: 'accepted', revision: 1 });
    await Promise.all([first, second]);

    expect(fake.uploads).toBe(1);
    expect(machine.getState()).toEqual({ revision: 1, status: 'synced' });
  });

  it('re-checks the link before a queued reconcile uploads', async () => {
    const fake = fakeTransport();
    const machine = machineWith(fake);

    fake.hold();
    const linking = machine.link();
    const reconciling = machine.reconcile();
    fake.release({ kind: 'network' });
    await Promise.all([linking, reconciling]);

    expect(fake.uploads).toBe(1);
    expect(machine.getState()).toEqual({ status: 'local' });
  });
});
