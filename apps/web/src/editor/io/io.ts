/**
 * The web-only I/O boundary for the editor's File control.
 *
 * Save downloads the current Source as a Kira file. Open replaces the
 * current Source from a chosen Kira file. The boundary owns the filename
 * policy, the Kira MIME type, the file-admission rules, and the DOM
 * plumbing (anchor download, object URL lifecycle, hidden file input)
 * so the editor page never touches `Blob`/`URL`/`document`/`File`
 * directly. Tests inject fakes to observe what would have happened
 * without the browser acting on it.
 *
 * SVG export, PNG export, font readiness, and SVG-to-PNG rasterization
 * belong to later increments; the seam here exists so they have a
 * single, well-defined place to plug into.
 */

import { slugify } from '@kiyora/dsl';

/** The agreed fallback base name when the current Diagram has no usable title. */
export const FILENAME_FALLBACK = 'diagram';

/** The extension every Kira file uses, written in lowercase. */
export const FILENAME_EXTENSION = 'kira';

/** The MIME type advertised for downloaded Kira files. */
export const REQUIRED_MIME_TYPE = 'text/plain;charset=utf-8';

/** The agreed upper bound for an opened Kira file (1 MiB). */
export const MAX_KIRA_BYTES = 1024 * 1024;

/** A browser-agnostic sink for "save this Blob to a file". */
export type Downloadable = {
	/** Trigger a download of `blob` as `filename`. The MIME type lives
	 * on `blob.type` so the caller does not have to repeat it. */
	save: (entry: { blob: Blob; filename: string }) => void;
};

/** A browser-agnostic source for "let the user pick a Kira file".
 *
 * Returns the chosen `File`, or `null` when the user cancelled the
 * picker. The boundary owns the hidden `<input type="file">` and its
 * lifecycle so callers never touch `document` directly. */
export type Openable = {
	pickFile: () => Promise<File | null>;
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
 * Read a `File` as Kiyora DSL Source after enforcing the Kira file
 * admission rules.
 *
 * Admission:
 * - The filename's extension (case-insensitive) must be `.kira`.
 * - The file must be no larger than `MAX_KIRA_BYTES` (1 MiB).
 *
 * The returned text is the raw Source the editor will compile. DSL
 * problems remain DSL Diagnostics downstream; this boundary only filters
 * file-shape errors so a bad file cannot destroy the workspace.
 */
export async function readKiraText(file: File): Promise<string> {
	if (!hasKiraExtension(file.name)) {
		throw new Error(
			`"${file.name}" is not a .kira file. Choose a Kira file with the .kira extension.`
		);
	}
	if (file.size > MAX_KIRA_BYTES) {
		throw new Error(
			`"${file.name}" is too large to open (${formatBytes(file.size)}; limit is 1 MiB).`
		);
	}
	return await file.text();
}

/** Case-insensitive `.kira` extension check on a filename. */
function hasKiraExtension(name: string): boolean {
	const lowered = name.toLowerCase();
	return lowered.endsWith(`.${FILENAME_EXTENSION}`);
}

/** Concise byte size string for human-readable error messages. */
function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KiB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/**
 * Drive a Kira Open from an injected `Openable` source.
 *
 * - A successful read calls `onSource` with the raw Source.
 * - A picker cancellation calls neither `onSource` nor `onError`; it is
 *   a quiet no-op so the editor keeps its current workspace.
 * - An admission or read failure calls `onError` with a concise message
 *   the editor renders in its file-status footer. `onSource` is not
 *   called, so the workspace Source is preserved.
 *
 * `onSource`/`onError` are not awaited; they are caller-owned side
 * effects (state setters, notifiers) that should not gate the picker
 * lifecycle.
 */
export function openKira(options: {
	openable: Openable;
	onSource: (source: string) => void;
	onError: (message: string) => void;
}): Promise<void> {
	const { openable, onSource, onError } = options;
	return openable.pickFile().then(async (file) => {
		if (file === null) {
			return;
		}
		try {
			const source = await readKiraText(file);
			onSource(source);
		} catch (cause) {
			const message =
				cause instanceof Error ? cause.message : 'Failed to open Kira file.';
			onError(message);
		}
	});
}

/**
 * The real browser Openable: a transient hidden `<input type="file">`
 * that advertises `.kira`, resolves with the chosen `File`, or `null`
 * when the user cancels.
 *
 * The input is created on demand, appended to the body, and removed
 * after each pick so it never lingers in the DOM.
 */
export function browserOpenable(): Openable {
	return {
		pickFile(): Promise<File | null> {
			return new Promise<File | null>((resolve) => {
				if (typeof document === 'undefined') {
					resolve(null);
					return;
				}
				const input = document.createElement('input');
				input.type = 'file';
				input.accept = `.${FILENAME_EXTENSION}`;
				input.style.display = 'none';
				input.addEventListener('change', () => {
					const file = input.files?.[0] ?? null;
					input.remove();
					resolve(file);
				});
				// `cancel` does not always fire in every browser, but where
				// it does it is the closest signal we have to a true no-op.
				input.addEventListener('cancel', () => {
					input.remove();
					resolve(null);
				});
				document.body.append(input);
				input.click();
			});
		},
	};
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
