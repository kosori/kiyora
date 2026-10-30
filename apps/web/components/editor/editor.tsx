'use client';

import {
  type BoardStorage,
  createEditor,
  type StorageFault,
} from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import type { Board } from '@kiyora/model';
import { useState } from 'react';
import { CopyPngProvider } from './copy-png-context';
import { EditorShell } from './editor-shell';

export type EditorProps = {
  board: Board;
  storage: BoardStorage;
  fault?: StorageFault | null;
  migratedFrom?: number | null;
  writable?: boolean;
  rewrite?: boolean;
};

/**
 * One board's editor: it owns the engine and gives it to the shell through the
 * provider, so the shell can read the view and the board with the hooks rather
 * than through props. The route remounts it by board id, so a different board
 * never inherits this engine, its history or its autosave.
 */
export const Editor = ({
  board,
  storage,
  fault = null,
  migratedFrom = null,
  writable = true,
  rewrite = false,
}: EditorProps) => {
  const [editor] = useState(() => createEditor(board));

  return (
    <EditorProvider editor={editor}>
      <CopyPngProvider>
        <EditorShell
          autosave={{
            fault,
            migratedFrom,
            rewrite,
            storage,
            writable,
          }}
        />
      </CopyPngProvider>
    </EditorProvider>
  );
};
