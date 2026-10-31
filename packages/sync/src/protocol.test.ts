import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';
import { decideSync, SYNC_LIMIT_BYTES } from './protocol';

const payload = (overrides: Record<string, unknown> = {}): unknown => ({
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

const board = (overrides: Record<string, unknown> = {}): Board =>
  parseBoard(payload(overrides) as Record<string, unknown>);

const stored = (revision: number, payloadHash: string) => ({
  payloadHash,
  revision,
});

describe('the sync protocol', () => {
  it('creates revision 1 when the server holds no copy', () => {
    const decision = decideSync(null, {
      baseRevision: null,
      bytes: 120,
      payload: payload(),
      payloadHash: 'hash-1',
    });

    expect(decision).toEqual({
      board: board(),
      kind: 'create',
      revision: 1,
    });
  });

  it('accepts a write built on the stored revision as the next revision', () => {
    const decision = decideSync(stored(3, 'hash-3'), {
      baseRevision: 3,
      bytes: 120,
      payload: payload(),
      payloadHash: 'hash-4',
    });

    expect(decision).toMatchObject({ kind: 'accept', revision: 4 });
  });

  it('treats a retry whose bytes already committed as the current revision', () => {
    const decision = decideSync(stored(3, 'same-bytes'), {
      baseRevision: 2,
      bytes: 120,
      payload: payload(),
      payloadHash: 'same-bytes',
    });

    expect(decision).toMatchObject({
      kind: 'idempotent',
      revision: 3,
    });
  });

  it('refuses a write built on a revision the server has moved past', () => {
    const decision = decideSync(stored(3, 'hash-3'), {
      baseRevision: 2,
      bytes: 120,
      payload: payload(),
      payloadHash: 'hash-4',
    });

    expect(decision).toEqual({ kind: 'conflict', revision: 3 });
  });

  it('refuses a write at a revision when the remote copy is gone', () => {
    const decision = decideSync(null, {
      baseRevision: 4,
      bytes: 120,
      payload: payload(),
      payloadHash: 'hash-4',
    });

    expect(decision).toEqual({ kind: 'conflict', revision: 0 });
  });

  it('refuses a payload over the sync limit before looking at it', () => {
    const decision = decideSync(null, {
      baseRevision: null,
      bytes: SYNC_LIMIT_BYTES + 1,
      payload: { id: 'not-a-board' },
      payloadHash: 'hash-1',
    });

    expect(decision).toEqual({
      bytes: SYNC_LIMIT_BYTES + 1,
      kind: 'too-large',
      limit: SYNC_LIMIT_BYTES,
    });
  });

  it('refuses a payload the board schema rejects', () => {
    const decision = decideSync(null, {
      baseRevision: null,
      bytes: 120,
      payload: payload({ shapes: 'not a list' }),
      payloadHash: 'hash-1',
    });

    expect(decision).toEqual({ kind: 'invalid', reason: 'schema' });
  });

  it('refuses a payload from another schema version rather than migrating it', () => {
    const decision = decideSync(null, {
      baseRevision: null,
      bytes: 120,
      payload: payload({ schemaVersion: SCHEMA_VERSION - 1 }),
      payloadHash: 'hash-1',
    });

    expect(decision).toEqual({ kind: 'invalid', reason: 'version' });
  });

  it('answers with the validated board, defaults included', () => {
    const decision = decideSync(null, {
      baseRevision: null,
      bytes: 120,
      payload: payload(),
      payloadHash: 'hash-1',
    });

    expect(decision.kind).toBe('create');
    if (decision.kind === 'create') {
      expect(decision.board.files).toEqual({});
      expect(decision.board.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });
});
