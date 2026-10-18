'use client';

import { createEditor } from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import { useCallback, useState } from 'react';
import { starterBoard } from '~/lib/starter-board';
import { BoardCanvas } from './board-canvas';
import { ShortcutDialog } from './shortcut-dialog';
import { ToolRail } from './tool-rail';
import { useShortcuts } from './use-shortcuts';

/** The editor route: it owns the engine and paints the board through the adapter. */
export const Editor = () => {
  const [editor] = useState(() => createEditor(starterBoard()));
  const [shortcuts, setShortcuts] = useState(false);

  const toggleShortcuts = useCallback(() => {
    setShortcuts((open) => !open);
  }, []);

  useShortcuts(editor, toggleShortcuts);

  return (
    <EditorProvider editor={editor}>
      <div className='flex h-full'>
        <ToolRail />
        <div className='relative min-w-0 flex-1'>
          <BoardCanvas />
        </div>
      </div>
      <ShortcutDialog onOpenChange={setShortcuts} open={shortcuts} />
    </EditorProvider>
  );
};
