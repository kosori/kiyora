'use client';

import { type ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { Button } from '~/components/ui/button';

export type DeleteBoardDialogProps = {
  /** What the board is called, so the confirm names what is lost. */
  title: string;
  /** A longer explanation, so a linked board can name both of its copies. */
  body?: ReactNode;
  /** Why the last attempt removed nothing, when the remote copy refused. */
  error?: string | null;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

const DEFAULT_BODY =
  'Its board and everything drawn on it are removed from this browser. This cannot be undone.';

/**
 * The confirmation before a board is deleted. It is a modal dialog rather than
 * `window.confirm`, so it names the board, takes a longer explanation when the
 * board has more than one copy, and leaves focus on the safe answer. Escape
 * cancels, like every other dismissal in the app.
 */
export const DeleteBoardDialog = ({
  body = DEFAULT_BODY,
  error = null,
  onConfirm,
  onOpenChange,
  open,
  title,
}: DeleteBoardDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const description = useId();

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

  return (
    <dialog
      aria-describedby={description}
      aria-labelledby={heading}
      className='m-auto max-w-md rounded-lg border border-border bg-background p-6 text-foreground outline-none backdrop:bg-foreground/20'
      data-testid='delete-dialog'
      onClose={close}
      ref={dialog}
    >
      <h2 className='mb-2 font-heading font-semibold text-lg' id={heading}>
        Delete “{title || 'Untitled'}”?
      </h2>
      <div className='mb-6 text-muted-foreground text-sm' id={description}>
        {body}
      </div>
      {error === null ? null : (
        <p
          className='mb-4 text-destructive text-sm'
          data-testid='delete-error'
          role='alert'
        >
          {error}
        </p>
      )}
      <div className='flex justify-end gap-2'>
        <Button
          data-testid='cancel-delete'
          onClick={close}
          size='sm'
          variant='outline'
        >
          Cancel
        </Button>
        <Button
          data-testid='confirm-delete'
          onClick={onConfirm}
          size='sm'
          variant='destructive'
        >
          Delete
        </Button>
      </div>
    </dialog>
  );
};
