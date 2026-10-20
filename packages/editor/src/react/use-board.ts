import type { Board } from '@kiyora/model';
import { useSyncExternalStore } from 'react';
import { useEditorContext } from './context';

/** The engine in scope, by the name the React surfaces use. */
export const useEditor = useEditorContext;

/** The board, re-rendering the caller whenever the engine publishes a change. */
export const useBoard = (): Board => {
  const editor = useEditorContext();
  return useSyncExternalStore(
    editor.subscribe,
    editor.getBoard,
    editor.getBoard
  );
};
