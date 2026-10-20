import type { PropsWithChildren } from 'react';
import type { Editor } from '../store';
import { EditorContext } from './context';

type Props = {
  editor: Editor;
};

/** Hosts the engine and hands it to every descendant. */
export const EditorProvider = ({
  children,
  editor,
}: PropsWithChildren<Props>) => (
  <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
);
