import type { ReactNode } from 'react';
import type { Editor } from '../store';
import { EditorContext } from './context';

/** Hosts the engine and hands it to every descendant. */
export const EditorProvider = ({
  children,
  editor,
}: {
  children: ReactNode;
  editor: Editor;
}) => (
  <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
);
