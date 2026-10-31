'use client';

import { useCallback, useState } from 'react';
import { Button } from '~/components/ui/button';
import { ShareDialog } from './share-dialog';

export type ShareControlProps = {
  boardId: string;
  /** Whether the board has a remote copy, so there is something to share. */
  linked: boolean;
};

/**
 * The share action on a linked board. A local-only board has no remote copy to
 * show, so the action is absent rather than disabled.
 */
export const ShareControl = ({ boardId, linked }: ShareControlProps) => {
  const [open, setOpen] = useState(false);
  const openDialog = useCallback(() => setOpen(true), []);

  if (!linked) {
    return null;
  }

  return (
    <>
      <Button
        data-testid='share-board'
        onClick={openDialog}
        size='sm'
        variant='outline'
      >
        Share
      </Button>
      <ShareDialog boardId={boardId} onOpenChange={setOpen} open={open} />
    </>
  );
};
