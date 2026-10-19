'use client';

import { createEditor } from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import { useCallback, useState } from 'react';
import { starterBoard } from '~/lib/starter-board';
import { BoardCanvas } from './board-canvas';
import { CrashProbe } from './crash-probe';
import { PanelBoundary } from './error-boundary';
import { FileControls } from './file-controls';
import { SaveIndicator } from './save-indicator';
import { ShortcutDialog } from './shortcut-dialog';
import { ToolRail } from './tool-rail';
import { useAutosave } from './use-autosave';

/**
 * The editor route: it owns the engine and paints the board through the adapter.
 * The rail and the camera cluster float over the canvas, so the board keeps the
 * whole surface and the camera's coordinates stay the canvas's own. Each panel
 * sits behind its own boundary, so a panel that throws cannot take the board.
 */
export const Editor = () => {
  const [editor] = useState(() => createEditor(starterBoard()));
  const [shortcuts, setShortcuts] = useState(false);
  const health = useAutosave(editor);

  const toggleShortcuts = useCallback(() => {
    setShortcuts((open) => !open);
  }, []);

  return (
    <EditorProvider editor={editor}>
      <div className='relative h-full'>
        <BoardCanvas onShowShortcuts={toggleShortcuts} />
        <PanelBoundary label='Tools'>
          <CrashProbe name='tools'>
            <ToolRail />
          </CrashProbe>
        </PanelBoundary>
        <FileControls />
        <PanelBoundary label='Status'>
          <CrashProbe name='status'>
            <SaveIndicator {...health} />
          </CrashProbe>
        </PanelBoundary>
      </div>
      <ShortcutDialog onOpenChange={setShortcuts} open={shortcuts} />
    </EditorProvider>
  );
};
