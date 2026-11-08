'use client';

import type { LibraryEntry } from '@kiyora/editor';
import { useBoard, useEditor, useView } from '@kiyora/editor/react';
import { IconHelp, IconLogin } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BoardCanvas } from './board-canvas';
import { ConflictDialog } from './conflict-dialog';
import { CopyStatus } from './copy-status';
import { CrashProbe } from './crash-probe';
import { EditorMenu } from './editor-menu';
import { PanelBoundary } from './error-boundary';
import { PresentOverlay } from './present-overlay';
import { type RailPanel, RightRail } from './right-rail';
import { SaveIndicator } from './save-indicator';
import { SelectionAnnouncer } from './selection-announcer';
import { ShortcutDialog } from './shortcut-dialog';
import { SyncIndicator } from './sync-indicator';
import { ToolRail } from './tool-rail';
import { useAppearance } from './use-appearance';
import { type AutosaveSetup, useAutosave } from './use-autosave';

/**
 * The editor's chrome and the board under it. The canvas is full-bleed and
 * every control floats over it in the corner it belongs to, so the board's
 * coordinates are the viewport's own and no column takes width from the board.
 *
 * Zen mode is a view flag, so hiding the chrome is a render, not a board write.
 * What counts as chrome is everything that frames the board: the menu, the
 * status, the tool rail, the panel rail, the zoom and history clusters, the
 * selection bar and the help button. The skip link and the heading stay, because
 * they are how a keyboard or a screen reader reaches the board at all.
 */
export const EditorShell = ({
  autosave,
  rename,
  conflictOpen = false,
}: {
  autosave: AutosaveSetup;
  rename: (title: string) => Promise<LibraryEntry | null>;
  conflictOpen?: boolean;
}) => {
  const editor = useEditor();
  const board = useBoard();
  const { zen } = useView();
  const [shortcuts, setShortcuts] = useState(false);
  const [resolving, setResolving] = useState(conflictOpen);
  const [panel, setPanel] = useState<RailPanel>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importSignal, setImportSignal] = useState(0);
  const { appearance, setAppearance } = useAppearance();
  const { health, sync } = useAutosave(editor, autosave);

  useEffect(() => {
    if (conflictOpen) {
      setResolving(true);
    }
  }, [conflictOpen]);

  const openConflict = useCallback(() => setResolving(true), []);
  const closeConflict = useCallback(() => setResolving(false), []);

  const toggleShortcuts = useCallback(() => {
    setShortcuts((open) => !open);
  }, []);

  const openDeck = useCallback(() => setPanel('deck'), []);
  const openCode = useCallback(() => setPanel('code'), []);
  const openImport = useCallback(() => {
    setMenuOpen(true);
    setImportSignal((value) => value + 1);
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
      <div className='relative h-svh w-full overflow-hidden'>
        <BoardCanvas
          onImportFile={openImport}
          onOpenCode={openCode}
          onOpenDeck={openDeck}
          onShowShortcuts={toggleShortcuts}
        />
        {zen ? null : (
          <>
            <CopyStatus />
            <div className='pointer-events-none absolute top-4 left-4 z-30 flex flex-wrap items-center gap-2 pr-14'>
              <div className='pointer-events-auto flex max-w-[calc(100vw-6rem)] flex-wrap items-center gap-2'>
                <EditorMenu
                  appearance={appearance}
                  importSignal={importSignal}
                  onAppearanceChange={setAppearance}
                  onOpenChange={setMenuOpen}
                  onShowShortcuts={toggleShortcuts}
                  open={menuOpen}
                  rename={rename}
                />
                {autosave.sync.signedIn ? null : (
                  <Link
                    className='chrome-surface chrome-icon chrome-muted flex h-8 items-center gap-1.5 px-2.5 text-[13px] hover:bg-[var(--chrome-hover)]'
                    href='/sign-in'
                  >
                    <IconLogin className='size-4' />
                    Sign in
                  </Link>
                )}
                <PanelBoundary label='Status'>
                  <CrashProbe name='status'>
                    <SaveIndicator {...health} />
                    <SyncIndicator
                      boardId={autosave.boardId}
                      linked={sync.linked}
                      onLink={sync.link}
                      onResolve={openConflict}
                      signedIn={autosave.sync.signedIn}
                      state={sync.state}
                    />
                  </CrashProbe>
                </PanelBoundary>
              </div>
            </div>
            <div className='absolute top-14 left-4 z-20'>
              <PanelBoundary label='Tools'>
                <CrashProbe name='tools'>
                  <ToolRail />
                </CrashProbe>
              </PanelBoundary>
            </div>
            <PanelBoundary label='Rail'>
              <CrashProbe name='rail'>
                <RightRail onPanelChange={setPanel} panel={panel} />
              </CrashProbe>
            </PanelBoundary>
            <button
              aria-label='Keyboard shortcuts'
              className='chrome-surface chrome-card chrome-muted absolute right-4 bottom-4 z-20 flex size-8 items-center justify-center hover:bg-[var(--chrome-hover)]'
              data-testid='help'
              onClick={toggleShortcuts}
              title='Keyboard shortcuts'
              type='button'
            >
              <IconHelp className='size-[18px]' />
            </button>
          </>
        )}
      </div>
      <PresentOverlay />
      <ConflictDialog
        copy={sync.conflict.copy}
        localPreview={sync.localPreview ?? undefined}
        localTitle={board.title}
        onClose={closeConflict}
        onDuplicateMine={sync.conflict.duplicateMine}
        onKeepMine={sync.conflict.keepMine}
        onOpen={sync.conflict.open}
        onTakeTheirs={sync.conflict.takeTheirs}
        open={resolving}
        signedIn={autosave.sync.signedIn}
      />
      <ShortcutDialog onOpenChange={setShortcuts} open={shortcuts} />
    </>
  );
};
