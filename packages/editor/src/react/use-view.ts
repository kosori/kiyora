import { useSyncExternalStore } from 'react';
import type { View } from '../store';
import { useEditor } from './use-board';

/**
 * The view, re-rendering the caller whenever the camera or the tool changes.
 * The board's own subscribers are not woken by a camera change, so panning and
 * zooming never repaint the board.
 */
export const useView = (): View => {
  const editor = useEditor();
  return useSyncExternalStore(
    editor.subscribeView,
    editor.getView,
    editor.getView
  );
};
