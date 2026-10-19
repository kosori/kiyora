import {
  type Board,
  migratePayload,
  parseBoard,
  SCHEMA_VERSION,
  versionOf,
} from '@kiyora/model';
import type { Editor } from '../store';
import { type CorruptReason, faultOf, type StorageFault } from './faults';
import type { BoardStorage } from './storage';

/**
 * What a read of the board key produced. `loaded` carries the board, and the
 * version it was lifted from when a migration ran; `fault` carries a typed
 * storage problem and whether the offending bytes were parked. `quarantined`
 * is what tells the caller it is safe to write a fresh board: the old bytes are
 * preserved under the quarantine key, never lost to the overwrite.
 */
export type BoardLoad =
  | { status: 'loaded'; board: Board; migratedFrom: number | null }
  | { status: 'empty' }
  | { status: 'fault'; fault: StorageFault; quarantined: boolean };

const corrupt = (reason: CorruptReason) =>
  ({ kind: 'corrupt', reason }) as const satisfies StorageFault;

/**
 * Reads the board this browser last saved. Bytes that will not parse are parked
 * under the quarantine key and reported, never silently replaced; a board from
 * an older schema is snapshotted, lifted through the migrations in `model`, and
 * handed back whole. A board from a newer release is quarantined rather than
 * guessed at. Nothing here overwrites anything until the caller decides to.
 */
export const loadBoard = async (storage: BoardStorage): Promise<BoardLoad> => {
  let raw: string | null;
  try {
    raw = await storage.read();
  } catch (error) {
    return { fault: faultOf(error), quarantined: false, status: 'fault' };
  }
  if (raw === null) {
    return { status: 'empty' };
  }
  const bytes = raw;

  const park = async (reason: CorruptReason): Promise<BoardLoad> => {
    const fault = corrupt(reason);
    try {
      await storage.quarantine(bytes);
      return { fault, quarantined: true, status: 'fault' };
    } catch {
      return { fault, quarantined: false, status: 'fault' };
    }
  };

  let payload: unknown;
  try {
    payload = JSON.parse(bytes) as unknown;
  } catch {
    return park('damaged');
  }

  const version = versionOf(payload);
  if (version === null) {
    return park('damaged');
  }
  if (version > SCHEMA_VERSION) {
    return park('newer');
  }

  let migratedFrom: number | null = null;
  if (version < SCHEMA_VERSION) {
    try {
      await storage.snapshot(bytes);
    } catch (error) {
      return { fault: faultOf(error), quarantined: false, status: 'fault' };
    }
    const lifted = migratePayload(payload);
    if (lifted.status === 'unreadable') {
      return park('migration');
    }
    if (lifted.status !== 'migrated') {
      return park('newer');
    }
    ({ payload } = lifted);
    migratedFrom = version;
  }

  try {
    return { board: parseBoard(payload), migratedFrom, status: 'loaded' };
  } catch {
    return park('damaged');
  }
};

/**
 * Opens `board` in the engine, bringing the view back to where the board was
 * left. The camera is in the board but not in its history, so restoring it is a
 * view change, not a board change, and never arms a save.
 */
export const restoreBoard = (editor: Editor, board: Board): void => {
  editor.setBoard(board);
  editor.setCamera(board.camera);
};
