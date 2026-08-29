/**
 * The web-only I/O boundary for the editor's File control.
 *
 * Save downloads the current Source as a Kira file. Open replaces the
 * current Source from a chosen Kira file. Export SVG hands a
 * self-contained copy of the current Scene to the browser as a portable
 * `.svg` download, embedding the licensed Kiyora typography so the
 * artifact renders consistently outside the app.
 *
 * The boundary owns the filename policy, the MIME types, the
 * file-admission rules, font readiness, and the DOM plumbing (anchor
 * download, object URL lifecycle, hidden file input) so the editor page
 * never touches `Blob`/`URL`/`document`/`File` directly. Tests inject
 * fakes to observe what would have happened without the browser acting
 * on it.
 *
 * PNG export and SVG-to-PNG rasterization belong to a later increment;
 * the seam here exists so they have a single, well-defined place to
 * plug into.
 */

import { slugify } from '@kiyora/dsl';
import { renderToSvg, type Scene } from '@kiyora/render';

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

/** The extension used by Kiyora SVG exports. */
export const SVG_EXTENSION = 'svg';

/** The MIME type advertised for downloaded Kiyora SVG exports. */
export const SVG_MIME_TYPE = 'image/svg+xml;charset=utf-8';

/**
 * Turn a Diagram title into a stable SVG download filename.
 *
 * Mirrors `kiraFilename`'s policy: the DSL's existing slug behavior
 * derives the base name; an unusable title falls back to `diagram.svg`
 * so SVG export always works.
 */
export function svgFilename(title: string): string {
	const trimmed = title.trim();
	if (trimmed.length === 0) {
		return `${FILENAME_FALLBACK}.${SVG_EXTENSION}`;
	}
	return `${slugify(trimmed)}.${SVG_EXTENSION}`;
}

/** A font face the SVG export embeds as a base64 data-URI @font-face rule. */
export type FontBytes = {
	/** Raw bytes the SVG embeds as `data:<mimeType>;base64,…`. */
	bytes: Uint8Array;
	/** MIME type recorded in the data URI (e.g. `font/woff2`). */
	mimeType: string;
};

/** The two faces the renderer currently uses: regular and bold. */
export type ExportFonts = {
	bold: FontBytes;
	regular: FontBytes;
};

/**
 * The family registered in the embedded `<style>` block. Must match
 * the family the renderer, the live editor canvas, and the
 * application CSS register so the export renders with the same shapes
 * as the editor.
 */
export const SVG_EXPORT_FONT_FAMILY = 'Balsamiq Sans Neue';

/**
 * Inject the Kiyora typography into a rendered SVG so it remains
 * self-contained when opened outside the app.
 *
 * The result embeds one `<style>` element right after the opening
 * `<svg>` tag declaring the family with `data:` URIs for each provided
 * face. The renderer already references the family name on the root
 * `<svg>` element, so the rest of the SVG picks up the embedded faces
 * without further rewriting.
 */
export function embedFontsInSvg(svg: string, fonts: ExportFonts): string {
	const regularUri = fontDataUri(fonts.regular);
	const boldUri = fontDataUri(fonts.bold);
	const regularFormat = fontFormat(fonts.regular);
	const boldFormat = fontFormat(fonts.bold);
	const styleBlock =
		`<style>@font-face{font-family:'${SVG_EXPORT_FONT_FAMILY}';font-style:normal;font-weight:400;src:url(${regularUri}) format('${regularFormat}');}` +
		`@font-face{font-family:'${SVG_EXPORT_FONT_FAMILY}';font-style:normal;font-weight:700;src:url(${boldUri}) format('${boldFormat}');}</style>`;
	return svg.replace(/(<svg\b[^>]*>)/, `$1${styleBlock}`);
}

/** Render a FontBytes payload as a CSS `data:` URL. */
function fontDataUri(font: FontBytes): string {
	return `data:${font.mimeType};base64,${bytesToBase64(font.bytes)}`;
}

/** Map a font MIME type to the matching `format('…')` token. */
function fontFormat(font: FontBytes): string {
	if (font.mimeType === 'font/woff2') {
		return 'woff2';
	}
	if (font.mimeType === 'font/woff') {
		return 'woff';
	}
	if (
		font.mimeType === 'font/ttf' ||
		font.mimeType === 'application/x-font-ttf'
	) {
		return 'truetype';
	}
	if (
		font.mimeType === 'font/otf' ||
		font.mimeType === 'application/x-font-otf'
	) {
		return 'opentype';
	}
	return 'woff2';
}

/** Base64-encode a byte array without depending on Node-only helpers. */
function bytesToBase64(bytes: Uint8Array): string {
	// `btoa` exists on every modern browser; the byte view is encoded
	// via `String.fromCharCode` so non-ASCII bytes survive the trip.
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

/**
 * Project the current Scene into a self-contained SVG and hand it to
 * the Downloadable.
 *
 * The export passes the Scene through the renderer's canonical static
 * projection so it matches the geometry, title, legend, escaping, and
 * bounds the renderer tests already lock down. The result then gets the
 * Kiyora typography embedded as `data:` URI `@font-face` rules so the
 * artifact looks correct outside the app, and is handed to the browser
 * download boundary with the agreed title-derived filename and MIME
 * type.
 */
export function downloadSvg(options: {
	downloadable: Downloadable;
	/** The current Scene to project. Caller is responsible for flushing
	 * any pending Source compile before taking this snapshot so the
	 * export reflects edits the user has just typed. */
	scene: Scene;
	/** The current Diagram title, used for the filename. */
	title: string;
	/** The two faces the renderer needs so the export is self-contained. */
	fonts: ExportFonts;
}): void {
	const { downloadable, scene, title, fonts } = options;
	const { svg } = renderToSvg(scene);
	const selfContained = embedFontsInSvg(svg, fonts);
	const filename = svgFilename(title);
	const blob = new Blob([selfContained], { type: SVG_MIME_TYPE });
	downloadable.save({ blob, filename });
}

/**
 * A promise that resolves once the Kiyora font faces are ready to use,
 * carrying the bytes the SVG export embeds.
 *
 * The editor disables Export SVG and Export PNG while this promise is
 * pending, so a disabled action is observable as "preparing fonts". A
 * rejection is treated as a permanent failure: the actions re-enable
 * and a file-operation error surfaces on attempted export.
 */
export type FontReadiness = {
	/** Resolves with the loaded faces; rejects when one cannot load. */
	ready: Promise<ExportFonts>;
};

/**
 * Browser-side font readiness: load the public `*.woff2` files in
 * parallel and resolve once they, and the `FontFaceSet`, are ready.
 *
 * The CSS `@font-face` rules in the application stylesheet point at
 * the same URLs, so the browser only fetches each face once: the same
 * HTTP request that primes the FontFaceSet also feeds the bytes the
 * export embeds.
 */
export function browserFontReadiness(): FontReadiness {
	return {
		ready: (async () => {
			if (typeof document === 'undefined') {
				throw new Error('Font readiness requires a browser.');
			}
			const [regular, bold] = await Promise.all([
				fetchBytes('/fonts/balsamiq-sans-neue-regular.woff2'),
				fetchBytes('/fonts/balsamiq-sans-neue-bold.woff2'),
			]);
			// Nudge the browser to load the faces synchronously with the
			// fetch above so the live canvas and any first paint using
			// the family do not stall behind the bytes-arriving event.
			await Promise.all([
				document.fonts.load(`400 16px "${SVG_EXPORT_FONT_FAMILY}"`),
				document.fonts.load(`700 16px "${SVG_EXPORT_FONT_FAMILY}"`),
			]);
			await document.fonts.ready;
			return {
				bold: { bytes: bold, mimeType: 'font/woff2' },
				regular: { bytes: regular, mimeType: 'font/woff2' },
			};
		})(),
	};
}

/** Fetch a binary URL as a `Uint8Array`. */
async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load ${url} (${response.status}).`);
	}
	const buffer = await response.arrayBuffer();
	return new Uint8Array(buffer);
}
