import { useSyncExternalStore } from 'react';
import type { Selection } from '../selection';
import { useEditor } from './use-board';

/** The selection, re-rendering the caller whenever it changes. */
export const useSelection = (): Selection => {
  const editor = useEditor();
  return useSyncExternalStore(
    editor.subscribeSelection,
    editor.getSelection,
    editor.getSelection
  );
};
