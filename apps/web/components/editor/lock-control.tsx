'use client';

import { useEditor } from '@kiyora/editor/react';
import { useCallback } from 'react';
import { Button } from '~/components/ui/button';

type Props = {
  locked: boolean;
};

/** Locks or unlocks the selection as one gesture, so one undo puts the flag back. */
export const LockControl = ({ locked }: Props) => {
  const editor = useEditor();
  const toggle = useCallback(() => editor.setLocked(!locked), [editor, locked]);

  return (
    <section>
      <h3 className='mb-1.5 text-muted-foreground text-xs uppercase tracking-wide'>
        Lock
      </h3>
      <Button
        aria-pressed={locked}
        className='w-full justify-start'
        data-testid='lock-toggle'
        onClick={toggle}
        size='sm'
        variant='outline'
      >
        {locked ? 'Unlock' : 'Lock'}
      </Button>
    </section>
  );
};
