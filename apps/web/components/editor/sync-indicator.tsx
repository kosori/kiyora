'use client';

import type { SyncState } from '@kiyora/sync';
import { cn } from 'cn';
import { ShareControl } from '~/components/share/share-control';
import { Button } from '~/components/ui/button';

type Props = {
  boardId: string;
  state: SyncState;
  signedIn: boolean;
  linked: boolean;
  onLink: () => void;
  /** Opens the surface that names the three resolutions. */
  onResolve: () => void;
};

const MIB = 1024 * 1024;

const sizeOf = (bytes: number): string => `${(bytes / MIB).toFixed(1)} MiB`;

const messageOf = (state: SyncState): string => {
  switch (state.status) {
    case 'local':
      return 'Local only';
    case 'pending':
      return `Pending sync · revision ${state.revision}`;
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return `Synced · revision ${state.revision}`;
    case 'conflict':
      return `Conflict · remote revision ${state.remote}`;
    case 'too-large':
      return 'Too large to sync';
    case 'signed-out':
      return 'Signed out — sync paused';
    case 'error':
      return state.reason === 'invalid'
        ? 'Sync refused — this board is invalid'
        : state.reason === 'unauthorized'
          ? 'Signed out — sync paused'
          : 'Sync failed — will retry';
    default:
      return 'Sync state unknown';
  }
};

const detailOf = (state: SyncState): string | undefined => {
  switch (state.status) {
    case 'too-large':
      return `${sizeOf(state.bytes)} is over the ${sizeOf(state.limit)} sync limit. The board stays in this browser.`;
    case 'conflict':
      return `The remote copy is at revision ${state.remote}; this one was built on ${state.local}. Choose which copy stays here.`;
    case 'signed-out':
      return 'Sign in to sync this board. Nothing is sent while signed out.';
    default:
      return undefined;
  }
};

const revisionOf = (state: SyncState): number | undefined => {
  switch (state.status) {
    case 'pending':
    case 'syncing':
    case 'synced':
      return state.revision;
    default:
      return undefined;
  }
};

/**
 * Where the local copy stands against its remote one, beside the save state.
 * The link action is the only path from local to remote, so it sits here and
 * nowhere else; a signed-out board shows that it is paused rather than
 * pretending a request is coming.
 */
export const SyncIndicator = ({
  boardId,
  state,
  signedIn,
  linked,
  onLink,
  onResolve,
}: Props) => {
  const canLink = signedIn && state.status === 'local';
  const conflict = state.status === 'conflict';
  const attention =
    state.status === 'conflict' ||
    state.status === 'too-large' ||
    state.status === 'error';

  return (
    <div className='absolute right-3 bottom-11 z-10 flex items-center gap-2'>
      <p
        aria-live='polite'
        className={cn(
          'rounded-full border px-2.5 py-1 text-xs shadow-sm backdrop-blur',
          attention
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'border-border bg-background/90 text-muted-foreground'
        )}
        data-bytes={state.status === 'too-large' ? state.bytes : undefined}
        data-limit={state.status === 'too-large' ? state.limit : undefined}
        data-reason={state.status === 'error' ? state.reason : undefined}
        data-remote={state.status === 'conflict' ? state.remote : undefined}
        data-revision={revisionOf(state)}
        data-state={state.status}
        data-testid='sync-status'
        role='status'
        title={detailOf(state)}
      >
        {messageOf(state)}
      </p>
      {canLink ? (
        <Button
          data-testid='link-board'
          onClick={onLink}
          size='sm'
          variant='outline'
        >
          Sync this board
        </Button>
      ) : null}
      <ShareControl
        boardId={boardId}
        linked={linked && state.status !== 'too-large'}
      />
      {conflict ? (
        <Button
          data-testid='open-conflict'
          onClick={onResolve}
          size='sm'
          variant='outline'
        >
          Resolve
        </Button>
      ) : null}
    </div>
  );
};
