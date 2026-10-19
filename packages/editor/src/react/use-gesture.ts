import { useSyncExternalStore } from 'react';
import type { Gesture } from '../store';
import { useEditor } from './use-board';

/** The open gesture, re-rendering the caller so a marquee follows the pointer. */
export const useGesture = (): Gesture => {
  const editor = useEditor();
  return useSyncExternalStore(
    editor.subscribeGesture,
    editor.getGesture,
    editor.getGesture
  );
};
