'use client';

import { keyshortcutsFor } from '@kiyora/editor';
import { useEditor, useHistory } from '@kiyora/editor/react';
import { useCallback } from 'react';
import { Button } from '~/components/ui/button';

/**
 * Undo and redo. Each button's enabled state is read from the history's own
 * notification — a commit wakes the subscriber — so a gesture cannot leave a
 * button stale.
 */
export const HistoryControls = () => {
  const editor = useEditor();
  const history = useHistory();
  const undo = useCallback(() => editor.undo(), [editor]);
  const redo = useCallback(() => editor.redo(), [editor]);

  return (
    <div
      aria-label='History'
      className='absolute bottom-14 left-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-background/90 p-1 shadow-sm backdrop-blur'
      role='toolbar'
    >
      <Button
        aria-keyshortcuts={keyshortcutsFor({ kind: 'undo' })}
        aria-label='Undo'
        data-testid='undo'
        disabled={!history.canUndo}
        onClick={undo}
        size='sm'
        variant='ghost'
      >
        Undo
      </Button>
      <Button
        aria-keyshortcuts={keyshortcutsFor({ kind: 'redo' })}
        aria-label='Redo'
        data-testid='redo'
        disabled={!history.canRedo}
        onClick={redo}
        size='sm'
        variant='ghost'
      >
        Redo
      </Button>
    </div>
  );
};
