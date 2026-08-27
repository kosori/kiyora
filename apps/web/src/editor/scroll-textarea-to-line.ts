/**
 * Compute a sensible scrollTop for a `<textarea>` so the given 1-based Kira
 * Source line is visible near the middle of the textarea.
 *
 * `lineHeightPx` is the line-box height of the textarea, in CSS pixels. The
 * caller is expected to read this from `getComputedStyle`. We intentionally
 * keep the math pure: this module never reaches for the DOM, so the
 * arithmetic is testable without happy-dom.
 */
export function lineScrollTop(
	line: number,
	lineHeightPx: number,
	visibleHeight = 0
): number {
	const safeLine = Math.max(1, line);
	const targetTop = (safeLine - 1) * lineHeightPx;
	// Centre the line in the visible region when we know the visible height;
	// without it, simply align the line to the top.
	const offset = visibleHeight > 0 ? Math.max(0, visibleHeight / 2) : 0;
	const top = Math.max(0, targetTop - offset);
	// The textarea's scrollable range is contentHeight - clientHeight; callers
	// can clamp further if they need a hard ceiling.
	return top;
}

/**
 * Resolve a textarea's line-box height in pixels.
 *
 * `getComputedStyle` returns the CSS value as a string. The common cases are
 * "20px" (a number with unit), "normal" (browser default), or empty. We
 * fall back to `fontSize * 1.5` for "normal" and a sane default of 20 when
 * neither is available.
 */
export function measureLineHeight(
	el: HTMLTextAreaElement,
	readComputedLineHeight: (el: HTMLTextAreaElement) => string,
	fontSizePx = 14
): number {
	const raw = readComputedLineHeight(el).trim();
	const parsed = Number.parseFloat(raw);
	if (Number.isFinite(parsed) && parsed > 0) {
		return parsed;
	}
	return fontSizePx * 1.5;
}

/**
 * Scroll a textarea so a 1-based Kira Source line is visible.
 *
 * Combines `measureLineHeight` and `lineScrollTop` with a DOM read and a
 * hard clamp against the textarea's scrollable range. No-op when the
 * textarea is missing or the line is non-positive.
 */
export function scrollTextareaToLine(
	textarea: HTMLTextAreaElement | null,
	line: number | null
): void {
	if (textarea === null || line === null) {
		return;
	}
	const lineHeight = measureLineHeight(
		textarea,
		(el) => window.getComputedStyle(el).lineHeight
	);
	const targetTop = lineScrollTop(line, lineHeight, textarea.clientHeight);
	const maxTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
	textarea.scrollTop = Math.min(targetTop, maxTop);
}
