import type { Board } from '@kiyora/model';
import { useContext, useSyncExternalStore } from 'react';
import type { Editor } from '../store';
import { EditorContext } from './context';

/** The engine in scope. Throws when a surface is rendered outside a provider. */
export const useEditor = (): Editor => {
  const editor = useContext(EditorContext);
  if (editor === null) {
    throw new Error('useEditor must be used inside an EditorProvider');
  }
  return editor;
};

/** The board, re-rendering the caller whenever the engine publishes a change. */
export const useBoard = (): Board => {
  const editor = useEditor();
  return useSyncExternalStore(
    editor.subscribe,
    editor.getBoard,
    editor.getBoard
  );
};
