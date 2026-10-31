'use client';

import Link from 'next/link';
import { httpSyncTransport } from '~/lib/sync/transport';
import { useBoardRoute } from '~/lib/use-board-route';
import { Editor } from '../editor/editor';

/**
 * One board's route. The engine and its autosave are keyed by the id, so moving
 * from one board to another cannot reuse the previous board's history or write
 * through the previous board's storage. A board that is not in the library says
 * so and offers the way back; it is never invented here.
 */
export const BoardRoute = ({
  boardId,
  signedIn,
}: {
  boardId: string;
  signedIn: boolean;
}) => {
  const state = useBoardRoute(boardId);

  if (state.status === 'loading') {
    return (
      <main className='grid h-svh place-items-center text-muted-foreground text-sm'>
        Opening the board…
      </main>
    );
  }

  if (state.status === 'missing') {
    return (
      <main
        className='mx-auto flex h-svh max-w-md flex-col items-start justify-center gap-4 p-6'
        data-testid='board-not-found'
      >
        <h1 className='font-semibold text-xl'>Board not found</h1>
        <p className='text-muted-foreground text-sm'>
          This browser does not hold a board at this address. It may have been
          deleted, or the link may belong to another browser.
        </p>
        <Link
          className='underline underline-offset-4'
          data-testid='back-to-library'
          href='/'
        >
          Back to the library
        </Link>
      </main>
    );
  }

  return (
    <main className='h-svh overflow-hidden'>
      <Editor
        board={state.board}
        boardId={boardId}
        fault={state.fault}
        key={boardId}
        migratedFrom={state.migratedFrom}
        rename={state.rename}
        rewrite={state.rewrite}
        storage={state.storage}
        sync={{
          record: state.sync,
          saveRecord: state.recordSync,
          signedIn,
          transport: httpSyncTransport,
        }}
        writable={state.writable}
      />
    </main>
  );
};
