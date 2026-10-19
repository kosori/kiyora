'use client';

import { createEditor } from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import { useCallback, useState } from 'react';
import { starterBoard } from '~/lib/starter-board';
import { BoardCanvas } from './board-canvas';
import { Inspector } from './inspector';
import { SaveIndicator } from './save-indicator';
import { ShortcutDialog } from './shortcut-dialog';
import { ToolRail } from './tool-rail';
import { useAutosave } from './use-autosave';

/**
 * The editor route: it owns the engine and paints the board through the adapter.
 * The rail and the inspector are columns, and the canvas owns the space between
 * them, so the board's coordinates are the canvas's own.
 */
export const Editor = () => {
  const [editor] = useState(() => createEditor(starterBoard()));
  const [shortcuts, setShortcuts] = useState(false);
  const status = useAutosave(editor);

  const toggleShortcuts = useCallback(() => {
    setShortcuts((open) => !open);
  }, []);

  return (
    <EditorProvider editor={editor}>
      <div className='flex h-full'>
        <ToolRail />
        <div className='relative h-full min-w-0 flex-1'>
          <BoardCanvas onShowShortcuts={toggleShortcuts} />
          <SaveIndicator status={status} />
        </div>
        <Inspector />
      </div>
      <ShortcutDialog onOpenChange={setShortcuts} open={shortcuts} />
    </EditorProvider>
  );
};
