import { useEffect } from 'react';

export type CompileShortcutOptions = {
	/** Disable the listener entirely (e.g. when the editor is not ready). */
	disabled?: boolean;
	/** Return true while a dialog or modal is open and should capture keys. */
	isDialogFocused?: () => boolean;
};

/**
 * Listen for ⌘/Ctrl+Enter on the window and call `onCompile` when fired.
 *
 * The keypress is "explicit compile": it bypasses the live debounce so the
 * user can commit an edit without waiting for the panel's debounce timer to
 * settle. The handler is always a no-op when `disabled` is true or a dialog
 * is focused, and is detached when the host component unmounts.
 */
export function useCompileShortcut(
	disabled: boolean,
	onCompile: () => void,
	{ isDialogFocused }: CompileShortcutOptions = {}
): void {
	useEffect(() => {
		if (disabled) {
			return;
		}
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key !== 'Enter') {
				return;
			}
			if (!(event.metaKey || event.ctrlKey)) {
				return;
			}
			if (isDialogFocused?.()) {
				return;
			}
			event.preventDefault();
			onCompile();
		}
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [disabled, isDialogFocused, onCompile]);
}
