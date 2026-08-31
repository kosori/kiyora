import { useEffect } from 'react';

export type FileShortcutOptions = {
	/** Override the textarea-focused check. Defaults to reading
	 * `document.activeElement` inside the keydown listener so SSR never
	 * observes `document`. */
	isTextareaFocused?: () => boolean;
	/** Called for ⌘/Ctrl+S. The handler always preventDefault to suppress
	 * the browser's native Save Page action. */
	onSave: () => void;
	/** Called for ⌘/Ctrl+O. The handler always preventDefault to suppress
	 * the browser's native Open File Location action. */
	onOpen: () => void;
};

/**
 * Bind ⌘/Ctrl+S and ⌘/Ctrl+O on the window to the editor's File menu
 * actions.
 *
 * Both shortcuts call `preventDefault` so the browser does not save the
 * page or open a file location dialog when the editor is focused. The
 * handler is a no-op while a textarea is focused so the code panel keeps
 * its native text-input shortcuts, and when the key has no modifier.
 * The default focused check is read inside the keydown listener, never
 * at render scope, so the hook is safe to mount in an SSR tree.
 *
 * The listener is detached when the host component unmounts.
 */
export function useFileShortcut({
	isTextareaFocused = defaultIsTextareaFocused,
	onOpen,
	onSave,
}: FileShortcutOptions): void {
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent): void {
			if (!(event.metaKey || event.ctrlKey)) {
				return;
			}
			if (isTextareaFocused()) {
				return;
			}
			const key = event.key.toLowerCase();
			if (key === 's') {
				event.preventDefault();
				onSave();
				return;
			}
			if (key === 'o') {
				event.preventDefault();
				onOpen();
			}
		}
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isTextareaFocused, onOpen, onSave]);
}

/** Default textarea-focused check: true when the active element is a TEXTAREA.
 *
 * Only invoked from inside the keydown listener, so SSR never touches
 * `document`. */
function defaultIsTextareaFocused(): boolean {
	return (
		typeof document !== 'undefined' &&
		document.activeElement?.tagName === 'TEXTAREA'
	);
}
