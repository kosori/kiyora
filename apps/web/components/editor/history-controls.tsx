'use client';

import { keyshortcutsFor } from '@kiyora/editor';
import { useEditor, useHistory } from '@kiyora/editor/react';
import { IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react';
import { useCallback } from 'react';
import { Button } from '~/components/ui/button';
import { usePlatform } from './use-platform';

/**
 * Undo and redo. Each button's enabled state is read from the history's own
 * notification — a commit wakes the subscriber — so a gesture cannot leave a
 * button stale.
 */
export const HistoryControls = () => {
  const editor = useEditor();
  const history = useHistory();
  const platform = usePlatform();
  const undo = useCallback(() => editor.undo(), [editor]);
  const redo = useCallback(() => editor.redo(), [editor]);

  return (
    <div
      aria-label='History'
      className='chrome-surface chrome-card flex h-10 items-center gap-0.5 p-1'
      role='toolbar'
    >
      <Button
        aria-keyshortcuts={keyshortcutsFor({ kind: 'undo' }, platform)}
        aria-label='Undo'
        className='chrome-icon'
        data-testid='undo'
        disabled={!history.canUndo}
        onClick={undo}
        size='icon'
        title='Undo'
        variant='ghost'
      >
        <IconArrowBackUp />
      </Button>
      <Button
        aria-keyshortcuts={keyshortcutsFor({ kind: 'redo' }, platform)}
        aria-label='Redo'
        className='chrome-icon'
        data-testid='redo'
        disabled={!history.canRedo}
        onClick={redo}
        size='icon'
        title='Redo'
        variant='ghost'
      >
        <IconArrowForwardUp />
      </Button>
    </div>
  );
};
