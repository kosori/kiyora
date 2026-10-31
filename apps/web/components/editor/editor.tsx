'use client';

import {
  type BoardStorage,
  createEditor,
  type LibraryEntry,
  type StorageFault,
} from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import type { Board } from '@kiyora/model';
import { useState } from 'react';
import { CopyPngProvider } from './copy-png-context';
import { EditorShell } from './editor-shell';
import type { AutosaveSetup } from './use-autosave';

export type EditorProps = {
  board: Board;
  /** The board's address, so presence and the clipboard stay on this board. */
  boardId: string;
  storage: BoardStorage;
  /** Commits a new name through the library, payload first. */
  rename: (title: string) => Promise<LibraryEntry | null>;
  /** Whether the route asked for the conflict surface on open. */
  conflictOpen?: boolean;
  /** The stored preview the conflict surface shows beside the remote one. */
  preview?: string;
  fault?: StorageFault | null;
  migratedFrom?: number | null;
  writable?: boolean;
  rewrite?: boolean;
  /** The account and the sync record this board's remote copy is reconciled against. */
  sync: AutosaveSetup['sync'];
};

/**
 * One board's editor: it owns the engine and gives it to the shell through the
 * provider, so the shell can read the view and the board with the hooks rather
 * than through props. The route remounts it by board id, so a different board
 * never inherits this engine, its history or its autosave.
 */
export const Editor = ({
  board,
  boardId,
  storage,
  rename,
  conflictOpen = false,
  preview,
  fault = null,
  migratedFrom = null,
  writable = true,
  rewrite = false,
  sync,
}: EditorProps) => {
  const [editor] = useState(() => createEditor(board));

  return (
    <EditorProvider editor={editor}>
      <CopyPngProvider>
        <EditorShell
          autosave={{
            boardId,
            fault,
            migratedFrom,
            preview,
            rewrite,
            storage,
            sync,
            writable,
          }}
          conflictOpen={conflictOpen}
          rename={rename}
        />
      </CopyPngProvider>
    </EditorProvider>
  );
};
