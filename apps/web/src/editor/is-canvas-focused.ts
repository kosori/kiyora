/**
 * True when the focused element is the canvas host or lives inside it.
 *
 * The canvas host is marked with `data-kiyora-canvas` by the React adapter
 * and is focusable, so window-level canvas shortcuts only run while the
 * user is actually on the canvas.
 *
 * Must only run inside an effect or event listener, never at render scope,
 * so SSR never observes `document`.
 */
export function isCanvasFocused(): boolean {
	if (typeof document === 'undefined') {
		return false;
	}
	const active = document.activeElement;
	return active !== null && active.closest('[data-kiyora-canvas]') !== null;
}
