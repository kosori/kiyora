/**
 * The web-only I/O boundary for the editor's File control.
 *
 * Save downloads the current Source as a Kira file. The boundary owns the
 * filename policy, the Kira MIME type, and the DOM plumbing (anchor
 * download, object URL lifecycle) so the editor page never touches
 * `Blob`/`URL`/`document` directly. Tests inject a fake `Downloadable`
 * to observe what would have been saved without the browser acting on it.
 *
 * The boundary is intentionally tiny: Save is a download of Source. Open,
 * SVG export, PNG export, font readiness, file-picker plumbing, and
 * SVG-to-PNG rasterization belong to later increments; the seam here
 * exists so they have a single, well-defined place to plug into.
 */

import { slugify } from '@kiyora/dsl';

/** The agreed fallback base name when the current Diagram has no usable title. */
export const FILENAME_FALLBACK = 'diagram';

/** The extension every downloaded Kira file uses. */
export const FILENAME_EXTENSION = 'kira';

/** The MIME type advertised for downloaded Kira files. */
export const REQUIRED_MIME_TYPE = 'text/plain;charset=utf-8';

/** A browser-agnostic sink for "save this Blob to a file". */
export type Downloadable = {
	/** Trigger a download of `blob` as `filename`. The MIME type lives
	 * on `blob.type` so the caller does not have to repeat it. */
	save: (entry: { blob: Blob; filename: string }) => void;
};

/**
 * Turn a Diagram title into a stable download filename.
 *
 * The base name uses the DSL's existing slug behavior; an unusable title
 * (empty, all-non-alphanumeric) falls back to `diagram.kira` so Save
 * always works.
 */
export function kiraFilename(title: string): string {
	const trimmed = title.trim();
	// An empty or all-whitespace title has no slug to derive a name from;
	// fall back to the agreed "diagram" base so Save always works.
	if (trimmed.length === 0) {
		return `${FILENAME_FALLBACK}.${FILENAME_EXTENSION}`;
	}
	return `${slugify(trimmed)}.${FILENAME_EXTENSION}`;
}

/**
 * Build a Blob from the given Source and hand it to the Downloadable.
 *
 * The `Source` here is the textual interchange format and the only thing
 * ever saved. Canvas-only Scene placement, selection, and the Viewport
 * are intentionally absent: their shape belongs to the Editor and they
 * are not part of a Kira file (see spec.md "Source and visual artifacts
 * are distinct").
 */
export function downloadKira(options: {
	downloadable: Downloadable;
	source: string;
	title: string;
}): void {
	const { downloadable, source, title } = options;
	const filename = kiraFilename(title);
	const blob = new Blob([source], { type: REQUIRED_MIME_TYPE });
	downloadable.save({ blob, filename });
}

/**
 * The real browser Downloadable: a transient `<a download>` click per
 * file, with the object URL revoked on the next tick so we don't leak.
 */
export function browserDownloadable(): Downloadable {
	return {
		save({ blob, filename }): void {
			if (typeof document === 'undefined') {
				return;
			}
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = filename;
			anchor.rel = 'noopener';
			anchor.style.display = 'none';
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			queueMicrotask(() => URL.revokeObjectURL(url));
		},
	};
}
