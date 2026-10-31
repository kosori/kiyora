'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  absoluteShareUrl,
  createShare,
  readShare,
  revokeShare,
} from '~/lib/share';

export type ShareDialogProps = {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Phase = 'loading' | 'ready' | 'error';

/**
 * The board's one unlisted address: read, created, copied, regenerated or
 * revoked. Regenerating and creating are the same server call, because both
 * revoke the previous live token before returning the next one, so there is no
 * path that leaves two addresses working.
 */
export const ShareDialog = ({
  boardId,
  open,
  onOpenChange,
}: ShareDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [phase, setPhase] = useState<Phase>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
      return;
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let live = true;
    setPhase('loading');
    setCopied(false);
    readShare(boardId)
      .then((liveToken) => {
        if (live) {
          setToken(liveToken);
          setPhase('ready');
        }
      })
      .catch(() => {
        if (live) {
          setPhase('error');
        }
      });

    return () => {
      live = false;
    };
  }, [boardId, open]);

  const run = async (action: () => Promise<string | null>): Promise<void> => {
    setBusy(true);
    setCopied(false);
    try {
      setToken(await action());
      setPhase('ready');
    } catch {
      setPhase('error');
    } finally {
      setBusy(false);
    }
  };

  const create = (): void => {
    run(() => createShare(boardId)).catch(() => undefined);
  };

  const regenerate = (): void => {
    run(() => createShare(boardId)).catch(() => undefined);
  };

  const revoke = (): void => {
    run(async () => {
      await revokeShare(boardId);
      return null;
    }).catch(() => undefined);
  };

  const copy = useCallback((): void => {
    if (token === null) {
      return;
    }
    navigator.clipboard
      .writeText(absoluteShareUrl(token))
      .then(() => setCopied(true))
      .catch(() => setPhase('error'));
  }, [token]);

  return (
    <dialog
      aria-labelledby={heading}
      className='m-auto w-full max-w-md rounded-lg border border-border bg-background p-6 text-foreground outline-none backdrop:bg-foreground/20'
      data-testid='share-dialog'
      onClose={close}
      ref={dialog}
    >
      <h2 className='mb-2 font-heading font-semibold text-lg' id={heading}>
        Share this board
      </h2>
      <p className='mb-4 text-muted-foreground text-sm'>
        Anyone with the link can view the latest saved revision. They cannot
        edit it, and the link can be revoked at any time.
      </p>
      {phase === 'loading' ? (
        <p className='text-muted-foreground text-sm'>Reading the link…</p>
      ) : null}
      {phase === 'error' ? (
        <p className='text-destructive text-sm' data-testid='share-error'>
          The share link could not be read. Try again.
        </p>
      ) : null}
      {phase !== 'error' && token !== null ? (
        <div className='flex flex-col gap-3'>
          <input
            aria-label='Share link'
            className='w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
            data-testid='share-url'
            readOnly
            value={absoluteShareUrl(token)}
          />
          <div className='flex flex-wrap justify-end gap-2'>
            <Button
              data-testid='copy-share-link'
              onClick={copy}
              size='sm'
              variant='outline'
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              data-testid='regenerate-share-link'
              disabled={busy}
              onClick={regenerate}
              size='sm'
              variant='outline'
            >
              Regenerate
            </Button>
            <Button
              data-testid='revoke-share-link'
              disabled={busy}
              onClick={revoke}
              size='sm'
              variant='destructive'
            >
              Revoke
            </Button>
          </div>
        </div>
      ) : null}
      {phase !== 'error' && phase !== 'loading' && token === null ? (
        <div className='flex flex-col gap-3'>
          <p className='text-muted-foreground text-sm'>
            This board has no share link.
          </p>
          <div className='flex justify-end'>
            <Button
              data-testid='create-share-link'
              disabled={busy}
              onClick={create}
              size='sm'
            >
              Create link
            </Button>
          </div>
        </div>
      ) : null}
      <div className='mt-6 flex justify-end'>
        <Button
          data-testid='close-share'
          onClick={close}
          size='sm'
          variant='outline'
        >
          Close
        </Button>
      </div>
    </dialog>
  );
};
