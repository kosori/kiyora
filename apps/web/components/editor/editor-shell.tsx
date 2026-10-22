'use client';

import { useEditor, useView } from '@kiyora/editor/react';
import { useCallback, useState } from 'react';
import { BoardCanvas } from './board-canvas';
import { CrashProbe } from './crash-probe';
import { PanelBoundary } from './error-boundary';
import { FileControls } from './file-controls';
import { HistoryControls } from './history-controls';
import { PresentOverlay } from './present-overlay';
import { RightRail } from './right-rail';
import { SaveIndicator } from './save-indicator';
import { SelectionAnnouncer } from './selection-announcer';
import { ShortcutDialog } from './shortcut-dialog';
import { ToolRail } from './tool-rail';
import { useAutosave } from './use-autosave';

/**
 * The editor's chrome and the board between it: the rail and the inspector are
 * columns, and the canvas owns the space between them, so the board's
 * coordinates are the canvas's own. Each panel sits behind its own boundary, so
 * a panel that throws cannot take the board.
 *
 * Zen mode is a view flag, so hiding the chrome is a render, not a board write.
 * What counts as chrome is everything that frames the board: the tool rail, the
 * right rail, the file, history and camera clusters, and the status pill. The
 * skip link and the heading stay, because they are how a keyboard or a screen
 * reader reaches the board at all.
 */
export const EditorShell = () => {
  const editor = useEditor();
  const { zen } = useView();
  const [shortcuts, setShortcuts] = useState(false);
  const health = useAutosave(editor);

  const toggleShortcuts = useCallback(() => {
    setShortcuts((open) => !open);
  }, []);

  return (
    <>
      <a
        className='sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus:ring-3 focus:ring-ring/50'
        href='#board'
      >
        Skip to board
      </a>
      <h1 className='sr-only'>Kiyora</h1>
      <SelectionAnnouncer />
      <div className='flex h-full'>
        {zen ? null : (
          <PanelBoundary label='Tools'>
            <CrashProbe name='tools'>
              <ToolRail />
            </CrashProbe>
          </PanelBoundary>
        )}
        <div className='relative h-full min-w-0 flex-1'>
          <BoardCanvas onShowShortcuts={toggleShortcuts} />
          {zen ? null : (
            <>
              <FileControls />
              <HistoryControls />
              <PanelBoundary label='Status'>
                <CrashProbe name='status'>
                  <SaveIndicator {...health} />
                </CrashProbe>
              </PanelBoundary>
            </>
          )}
        </div>
        {zen ? null : (
          <PanelBoundary label='Rail'>
            <CrashProbe name='rail'>
              <RightRail />
            </CrashProbe>
          </PanelBoundary>
        )}
      </div>
      <PresentOverlay />
      <ShortcutDialog onOpenChange={setShortcuts} open={shortcuts} />
    </>
  );
};
