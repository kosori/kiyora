import { createContext, useContext } from 'react';
import type { Editor } from '../store';

/** The engine every React surface under the provider reads. */
export const EditorContext = createContext<Editor | undefined>(undefined);

/** The engine in scope. Throws when a surface is rendered outside a provider. */
export const useEditorContext = (): Editor => {
  const editor = useContext(EditorContext);
  if (editor === undefined) {
    throw new Error('useEditorContext must be used inside an EditorProvider');
  }
  return editor;
};
