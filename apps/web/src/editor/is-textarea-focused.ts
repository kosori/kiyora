/**
 * True when the currently focused element is a `<textarea>`.
 *
 * Co-located with `error-message.ts` because both are tiny pure
 * browser-boundary utilities consumed by hooks in this folder.
 *
 * Must only run inside an effect or event listener, never at render scope,
 * so SSR never observes `document`.
 */
export function isTextareaFocused(): boolean {
	return (
		typeof document !== 'undefined' &&
		document.activeElement?.tagName === 'TEXTAREA'
	);
}
