import type { Editor } from '@kiyora/canvas/react';
import { useEffect } from 'react';
import { isTextareaFocused as defaultIsTextareaFocused } from './is-textarea-focused';

export type EditorKeyboardShortcutsOptions = {
	/** Override the textarea-focused check. Defaults to reading
	 * `document.activeElement` inside the keydown listener so SSR never
	 * observes `document`. */
	isTextareaFocused?: () => boolean;
};

/**
 * Bind ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z on the window to the editor's undo/redo.
 *
 * The handler is a no-op while a textarea is focused, so the code
 * panel's native text undo keeps working. The default check reads
 * `document.activeElement` from inside the keydown listener — never at
 * render scope — so the hook is safe to mount in an SSR tree. The
 * listener is detached when the host component unmounts.
 */
export function useEditorKeyboardShortcuts(
	editor: Editor,
	{
		isTextareaFocused = defaultIsTextareaFocused,
	}: EditorKeyboardShortcutsOptions = {}
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
