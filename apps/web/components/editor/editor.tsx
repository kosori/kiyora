'use client';

import { createEditor } from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import { useState } from 'react';
import { starterBoard } from '~/lib/starter-board';
import { CopyPngProvider } from './copy-png-context';
import { EditorShell } from './editor-shell';

/**
 * The editor route: it owns the engine and gives it to the shell through the
 * provider, so the shell can read the view and the board with the hooks rather
 * than through props.
 */
export const Editor = () => {
  const [editor] = useState(() => createEditor(starterBoard()));

  return (
    <EditorProvider editor={editor}>
      <CopyPngProvider>
        <EditorShell />
      </CopyPngProvider>
    </EditorProvider>
  );
};
