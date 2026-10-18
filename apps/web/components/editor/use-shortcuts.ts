'use client';

import { type Editor, resolveKey } from '@kiyora/editor';
import { useEffect } from 'react';

/** Runs every window keydown through the keymap, so the bindings and the dialog cannot drift. */
export const useShortcuts = (
  editor: Editor,
  onShowShortcuts: () => void
): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const command = resolveKey(event.key);
      if (command === null) {
        return;
      }

      if (command.kind === 'tool') {
        editor.setTool(command.tool);
        return;
      }

      onShowShortcuts();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editor, onShowShortcuts]);
};
