'use client';

import { createEditor } from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import { useCallback, useState } from 'react';
import { starterBoard } from '~/lib/starter-board';
import { BoardCanvas } from './board-canvas';
import { CrashProbe } from './crash-probe';
import { DeckPanel } from './deck-panel';
import { PanelBoundary } from './error-boundary';
import { FileControls } from './file-controls';
import { HistoryControls } from './history-controls';
import { Inspector } from './inspector';
import { PresentOverlay } from './present-overlay';
import { SaveIndicator } from './save-indicator';
import { ShortcutDialog } from './shortcut-dialog';
import { ToolRail } from './tool-rail';
import { useAutosave } from './use-autosave';

/**
 * The editor route: it owns the engine and paints the board through the adapter.
 * The rail and the inspector are columns, and the canvas owns the space between
 * them, so the board's coordinates are the canvas's own. Each panel sits behind
 * its own boundary, so a panel that throws cannot take the board.
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
      <div className='flex h-full'>
        <PanelBoundary label='Tools'>
          <CrashProbe name='tools'>
            <ToolRail />
          </CrashProbe>
        </PanelBoundary>
        <div className='relative h-full min-w-0 flex-1'>
          <BoardCanvas onShowShortcuts={toggleShortcuts} />
          <FileControls />
          <HistoryControls />
          <PanelBoundary label='Status'>
            <CrashProbe name='status'>
              <SaveIndicator {...health} />
            </CrashProbe>
          </PanelBoundary>
        </div>
        <PanelBoundary label='Inspector'>
          <CrashProbe name='inspector'>
            <Inspector />
          </CrashProbe>
        </PanelBoundary>
        <PanelBoundary label='Deck'>
          <CrashProbe name='deck'>
            <DeckPanel />
          </CrashProbe>
        </PanelBoundary>
      </div>
      <PresentOverlay />
      <ShortcutDialog onOpenChange={setShortcuts} open={shortcuts} />
    </EditorProvider>
  );
};
