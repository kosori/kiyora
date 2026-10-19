import { useSyncExternalStore } from 'react';
import type { PresentState } from '../store';
import { useEditor } from './use-board';

/**
 * The presentation state, re-rendering the caller whenever it changes. Presenting
 * is display state, so this subscription is separate from the board's: a slide
 * show never wakes the canvas or the autosave.
 */
export const usePresent = (): PresentState => {
  const editor = useEditor();
  return useSyncExternalStore(
    editor.subscribePresent,
    editor.getPresent,
    editor.getPresent
  );
};
