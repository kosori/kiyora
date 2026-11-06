import {
  createLibrary,
  faultOf,
  type LibraryEntry,
  type StorageFault,
} from '@kiyora/editor';
import { type Board, parseBoardFile } from '@kiyora/model';
import type {
  BoardPage,
  RemoteBoardList,
  RemoteBoardSummary,
  SyncTransport,
} from '@kiyora/sync';
import { openStore } from './board-storage';
import {
  httpSyncTransport,
  SyncExchangeFailure,
  type SyncExchangeReason,
} from './sync/transport';

/** Every outcome of opening one remote copy, so a surface always has copy. */
export type RemoteBoardOpen =
  | { status: 'opened'; entry: LibraryEntry }
  | { status: 'gone' }
  | { status: 'held' }
  | { status: 'unavailable'; reason: 'network' | 'server' | 'unauthorized' }
  | { status: 'fault'; fault: StorageFault };

/** The first page the library reads; the caller asks for later pages itself. */
const FIRST_PAGE: BoardPage = { limit: 50, offset: 0 };

/**
 * Reads a downloaded payload the way a board file is read, so an older remote
 * copy runs the same migration chain and a newer one is refused rather than
 * guessed at, instead of a second reader being invented for the download.
 */
const lift = (payload: Board): Board => parseBoardFile(JSON.stringify(payload));

/** Why a failed exchange happened, in the vocabulary `RemoteBoardOpen` names. */
const reasonOf = (error: unknown): SyncExchangeReason =>
  error instanceof SyncExchangeFailure ? error.reason : 'server';

/**
 * One page of the remote copies this account holds, without any of their
 * payloads. A failed listing is a named status, never an empty account.
 */
export const listRemoteBoards = async (
  page: BoardPage = FIRST_PAGE,
  transport: SyncTransport = httpSyncTransport
): Promise<RemoteBoardList> => {
  try {
    return await transport.list(page);
  } catch {
    return { status: 'server' };
  }
};

const openRemote = async (
  summary: RemoteBoardSummary,
  transport: SyncTransport
): Promise<RemoteBoardOpen> => {
  let downloaded: Awaited<ReturnType<SyncTransport['download']>>;

  try {
    downloaded = await transport.download(summary.id);
  } catch (error) {
    return { reason: reasonOf(error), status: 'unavailable' };
  }

  if (downloaded === null) {
    return { status: 'gone' };
  }

  let board: Board;

  try {
    board = lift(downloaded.payload);
  } catch {
    return { reason: 'server', status: 'unavailable' };
  }

  if (board.id !== summary.id) {
    return { reason: 'server', status: 'unavailable' };
  }

  let opened: Awaited<ReturnType<typeof openStore>>;

  try {
    opened = await openStore();
  } catch (error) {
    return { fault: faultOf(error), status: 'fault' };
  }

  if (opened.fault !== null) {
    return { fault: opened.fault, status: 'fault' };
  }

  const library = createLibrary(opened.store);

  try {
    if (await library.holds(board.id)) {
      return { status: 'held' };
    }
    await library.create(board);
  } catch (error) {
    return { fault: faultOf(error), status: 'fault' };
  }

  try {
    await library.setSync(board.id, {
      conflict: null,
      linked: true,
      pending: false,
      revision: downloaded.revision,
      tooLarge: false,
    });
  } catch (error) {
    // The board is not linked until its record says so, so a failed metadata
    // write must not leave an unlinked local copy behind. The cleanup is
    // best-effort: the fault reported is the one that stopped the link.
    await library.remove(board.id).catch(() => undefined);
    return { fault: faultOf(error), status: 'fault' };
  }

  try {
    const entry = (await library.entries()).find(
      (candidate) => candidate.id === board.id
    );

    return entry === undefined
      ? { fault: { kind: 'unavailable' }, status: 'fault' }
      : { entry, status: 'opened' };
  } catch (error) {
    return { fault: faultOf(error), status: 'fault' };
  }
};

const inFlight = new Map<string, Promise<RemoteBoardOpen>>();

/**
 * Downloads one remote copy into this browser as a local copy under its own id,
 * then records it linked at the revision that came with the bytes. Two
 * concurrent openings of the same board share one exchange and one write.
 */
export const downloadRemoteBoard = (
  summary: RemoteBoardSummary,
  transport: SyncTransport = httpSyncTransport
): Promise<RemoteBoardOpen> => {
  const pending = inFlight.get(summary.id);

  if (pending !== undefined) {
    return pending;
  }

  const work = openRemote(summary, transport).finally(() => {
    inFlight.delete(summary.id);
  });

  inFlight.set(summary.id, work);

  return work;
};
