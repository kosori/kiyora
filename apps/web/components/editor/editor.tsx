'use client';

import { createEditor } from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import { useCallback, useState } from 'react';
import { starterBoard } from '~/lib/starter-board';
import { BoardCanvas } from './board-canvas';
import { SaveIndicator } from './save-indicator';
import { ShortcutDialog } from './shortcut-dialog';
import { ToolRail } from './tool-rail';
import { useAutosave } from './use-autosave';
import { useShortcuts } from './use-shortcuts';

/**
 * The editor route: it owns the engine and paints the board through the adapter.
 * The rail and the camera cluster float over the canvas, so the board keeps the
 * whole surface and the camera's coordinates stay the canvas's own.
 */
export const Editor = () => {
  const [editor] = useState(() => createEditor(starterBoard()));
  const [shortcuts, setShortcuts] = useState(false);
  const status = useAutosave(editor);

  const toggleShortcuts = useCallback(() => {
    setShortcuts((open) => !open);
  }, []);

  useShortcuts(editor, toggleShortcuts);

  return (
    <EditorProvider editor={editor}>
      <div className='relative h-full'>
        <BoardCanvas />
        <ToolRail />
        <SaveIndicator status={status} />
      </div>
      <ShortcutDialog onOpenChange={setShortcuts} open={shortcuts} />
    </EditorProvider>
  );
};
