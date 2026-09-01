import type { Editor, NudgeDirection } from '@kiyora/canvas/react';
import { useEffect } from 'react';
import { isTextareaFocused as defaultIsTextareaFocused } from './is-textarea-focused';

export type CanvasKeyboardShortcutsOptions = {
	/** Override the textarea-focused check. Defaults to reading
	 * `document.activeElement` inside the keydown listener so SSR never
	 * observes `document`. */
	isTextareaFocused?: () => boolean;
};

const ARROW_DIRECTIONS: Record<string, NudgeDirection> = {
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
};

/**
 * Bind canvas structural-edit and nudge shortcuts on the window to the
 * editor: Delete/Backspace deletes the selection, ⌘/Ctrl+C, ⌘/Ctrl+X,
 * ⌘/Ctrl+V, and ⌘/Ctrl+D copy, cut, paste, and duplicate, and the arrow
 * keys nudge the selection (Shift for a grid step).
 *
 * The handler is a no-op while a textarea is focused, so the code panel
 * keeps its native text editing. The default check reads
 * `document.activeElement` from inside the keydown listener — never at
 * render scope — so the hook is safe to mount in an SSR tree. A nudge
 * coalesces into a single History entry per key run: `beginNudge` fires
 * on the first keydown and `endNudge` on the matching keyup. The
 * listener is detached when the host component unmounts.
 */
export function useCanvasKeyboardShortcuts(
	editor: Editor,
	{
		isTextareaFocused = defaultIsTextareaFocused,
	}: CanvasKeyboardShortcutsOptions = {}
): void {
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent): void {
			if (isTextareaFocused()) {
				return;
			}
			if (event.metaKey || event.ctrlKey) {
				handleModifierKey(event);
				return;
			}
			if (event.key === 'Delete' || event.key === 'Backspace') {
				event.preventDefault();
				editor.deleteSelection();
				return;
			}
			handleNudgeKey(event);
		}

		function handleKeyUp(event: KeyboardEvent): void {
			if (ARROW_DIRECTIONS[event.key]) {
				editor.endNudge();
			}
		}

		function handleNudgeKey(event: KeyboardEvent): void {
			const direction = ARROW_DIRECTIONS[event.key];
			if (!direction || editor.getSelection().length === 0) {
				return;
			}
			event.preventDefault();
			editor.beginNudge();
			editor.nudge(direction, event.shiftKey);
		}

		function handleModifierKey(event: KeyboardEvent): void {
			switch (event.key.toLowerCase()) {
				case 'c':
					event.preventDefault();
					editor.copy();
					break;
				case 'x':
					event.preventDefault();
					editor.cut();
					break;
				case 'v':
					event.preventDefault();
					editor.paste();
					break;
				case 'd':
					event.preventDefault();
					editor.duplicate();
					break;
				default:
			}
		}
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	}, [editor, isTextareaFocused]);
}
