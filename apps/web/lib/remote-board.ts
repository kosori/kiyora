import { createLibrary, type LibraryEntry } from '@kiyora/editor';
import { type Board, parseBoardFile } from '@kiyora/model';
import type { RemoteBoardSummary, SyncTransport } from '@kiyora/sync';
import { openStore } from './board-storage';
import { httpSyncTransport } from './sync/transport';

/**
 * Reads a downloaded payload the way a board file is read, so an older remote
 * copy runs the same migration chain and a newer one is refused rather than
 * guessed at, instead of a second reader being invented for the download.
 */
const lift = (payload: Board): Board => parseBoardFile(JSON.stringify(payload));

/** Every remote copy this account holds, without any of their payloads. */
export const listRemoteBoards = (
  transport: SyncTransport = httpSyncTransport
): Promise<RemoteBoardSummary[]> => transport.list();

/**
 * Downloads one remote copy into this browser as a local copy under its own id,
 * then records it linked at the revision that came with the bytes. Returns the
 * stored entry, or `null` when the board is gone remotely or this browser
 * already holds it.
 */
export const downloadRemoteBoard = async (
  summary: RemoteBoardSummary,
  transport: SyncTransport = httpSyncTransport
): Promise<LibraryEntry | null> => {
  const downloaded = await transport.download(summary.id);

  if (downloaded === null) {
    return null;
  }

  const board = lift(downloaded.payload);
  const { store } = await openStore();
  const library = createLibrary(store);

  if (await library.holds(board.id)) {
    return null;
  }

  await library.create(board);
  await library.setSync(board.id, {
    conflict: null,
    linked: true,
    pending: false,
    revision: downloaded.revision,
    tooLarge: false,
  });

  return (
    (await library.entries()).find((entry) => entry.id === board.id) ?? null
  );
};
