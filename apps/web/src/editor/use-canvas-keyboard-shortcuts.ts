import type { Editor, NudgeDirection } from '@kiyora/canvas/react';
import { useEffect } from 'react';
import { isCanvasFocused as defaultIsCanvasFocused } from './is-canvas-focused';

export type CanvasKeyboardShortcutsOptions = {
	/** Override the canvas-focused check. Defaults to reading
	 * `document.activeElement` inside the keydown listener so SSR never
	 * observes `document`. */
	isCanvasFocused?: () => boolean;
};

const ARROW_DIRECTIONS: Record<string, NudgeDirection> = {
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
};

type OpenRun = 'nudge' | 'resize';

/**
 * Bind canvas structural-edit, nudge, and keyboard-resize shortcuts on the
 * window to the editor: Delete/Backspace deletes the selection, ⌘/Ctrl+C,
 * ⌘/Ctrl+X, ⌘/Ctrl+V, and ⌘/Ctrl+D copy, cut, paste, and duplicate, the
 * arrow keys nudge the selection (Shift for a grid step), and Alt+Arrow
 * resizes the single selected node toward the arrow (Shift to shrink).
 *
 * The handler is a no-op unless the canvas host has focus, so the code
 * panel and other controls keep their native keyboard behavior. The
 * default check reads `document.activeElement` from inside the keydown
 * listener — never at render scope — so the hook is safe to mount in an
 * SSR tree. A nudge or keyboard resize coalesces into a single History
 * entry per key run: the first keydown opens the gesture and the matching
 * keyup closes it. The hook only closes gestures it opened itself, so a
 * pointer resize in flight is never committed by an arrow release. The
 * listener is detached when the host component unmounts.
 */
export function useCanvasKeyboardShortcuts(
	editor: Editor,
	{
		isCanvasFocused = defaultIsCanvasFocused,
	}: CanvasKeyboardShortcutsOptions = {}
): void {
	useEffect(() => {
		let openRun: OpenRun | null = null;

		function closeOpenRun(): void {
			if (openRun === 'nudge') {
				editor.endNudge();
			} else if (openRun === 'resize') {
				editor.endResize();
			}
			openRun = null;
		}

		function handleKeyDown(event: KeyboardEvent): void {
			if (!isCanvasFocused()) {
				return;
			}
			if (event.metaKey || event.ctrlKey) {
				handleModifierKey(event);
				return;
			}
			if (event.key === 'Delete' || event.key === 'Backspace') {
				closeOpenRun();
				event.preventDefault();
				editor.deleteSelection();
				return;
			}
			handleNudgeKey(event);
		}

		function handleKeyUp(event: KeyboardEvent): void {
			if (ARROW_DIRECTIONS[event.key]) {
				closeOpenRun();
			}
		}

		function handleNudgeKey(event: KeyboardEvent): void {
			const direction = ARROW_DIRECTIONS[event.key];
			if (!direction) {
				return;
			}
			if (event.altKey) {
				if (editor.resizeBy(direction, event.shiftKey)) {
					if (openRun === 'nudge') {
						closeOpenRun();
					}
					openRun = 'resize';
					event.preventDefault();
				}
				return;
			}
			if (editor.getSelection().length === 0) {
				return;
			}
			if (openRun === 'resize') {
				closeOpenRun();
			}
			event.preventDefault();
			editor.beginNudge();
			editor.nudge(direction, event.shiftKey);
			openRun = 'nudge';
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
	}, [editor, isCanvasFocused]);
}
