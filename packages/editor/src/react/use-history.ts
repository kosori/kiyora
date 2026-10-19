import { useSyncExternalStore } from 'react';
import type { HistoryState } from '../history/stack';
import { useEditor } from './use-board';

/**
 * Whether undo and redo are possible, re-rendering whenever a commit changes
 * it. The value comes from the history's own notification, never a poll, so a
 * control cannot stay stale after a gesture.
 */
export const useHistory = (): HistoryState => {
  const editor = useEditor();
  return useSyncExternalStore(
    editor.subscribeHistory,
    editor.getHistory,
    editor.getHistory
  );
};
