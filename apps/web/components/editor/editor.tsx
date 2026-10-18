'use client';

import { createEditor } from '@kiyora/editor';
import { EditorProvider } from '@kiyora/editor/react';
import { useState } from 'react';
import { starterBoard } from '~/lib/starter-board';
import { BoardCanvas } from './board-canvas';

/** The editor route: it owns the engine and paints the board through the adapter. */
export const Editor = () => {
  const [editor] = useState(() => createEditor(starterBoard()));

  return (
    <EditorProvider editor={editor}>
      <BoardCanvas />
    </EditorProvider>
  );
};
