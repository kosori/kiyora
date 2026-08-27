import type { Editor } from '@kiyora/canvas/react';
import { useEffect } from 'react';

export type EditorKeyboardShortcutsOptions = {
	/** Return true when a text input is focused and should keep native undo. */
	isTextareaFocused: () => boolean;
};

/**
 * Bind ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z on the window to the editor's undo/redo.
 *
 * The handler is a no-op while `isTextareaFocused()` is true, so the code
 * panel's native text undo keeps working. The listener is detached when the
 * host component unmounts.
 */
export function useEditorKeyboardShortcuts(
	editor: Editor,
	{ isTextareaFocused }: EditorKeyboardShortcutsOptions
): void {
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent): void {
			if (!(event.metaKey || event.ctrlKey)) {
				return;
			}
			if (event.key !== 'z' && event.key !== 'Z') {
				return;
			}
			if (isTextareaFocused()) {
				return;
			}
			event.preventDefault();
			if (event.shiftKey) {
				editor.redo();
			} else {
				editor.undo();
			}
		}
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [editor, isTextareaFocused]);
}
