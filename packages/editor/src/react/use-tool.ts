import { useSyncExternalStore } from 'react';
import type { Tool } from '../tools';
import { useEditor } from './use-board';

/** The active tool, re-rendering the caller whenever the tool changes. */
export const useTool = (): Tool => {
  const editor = useEditor();
  return useSyncExternalStore(editor.subscribe, editor.getTool, editor.getTool);
};
