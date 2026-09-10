/**
 * The web-only I/O boundary for the editor's File control.
 *
 * Save downloads the current Source as a Kira file. Open replaces the
 * current Source from a chosen Kira file. Export SVG hands a
 * self-contained copy of the current Scene to the browser as a portable
 * `.svg` download, embedding the licensed Kiyora typography so the
 * artifact renders consistently outside the app. Export PNG rasterizes
 * that same portable SVG at twice its natural resolution into a
 * transparent `.png` download, with a safety limit that rejects output
 * the browser cannot reliably rasterize.
 *
 * The boundary owns the filename policy, the MIME types, the
 * file-admission rules, font readiness, and the DOM plumbing (anchor
 * download, object URL lifecycle, hidden file input, Image/Canvas
 * rasterization) so the editor page never touches `Blob`/`URL`/`document`/
 * `File`/`Image`/`Canvas` directly. Tests inject fakes to observe what
 * would have happened without the browser acting on it.
 */

import { slugify } from '@kiyora/dsl';
import { renderToSvg, type Scene } from '@kiyora/render';
import { errorMessageOf } from '../error-message';

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
			onError(errorMessageOf(cause, 'Failed to open Kira file.'));
		}
	});
}

export const FOCUS_CANCEL_FALLBACK_MS = 300;

/**
 * The real browser Openable: a hidden `<input type="file" accept=".kira">`
 * added to the DOM, clicked programmatically, and resolved once when the user
 * selects a file or cancels the dialog.
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

				let isResolved = false;
				let timeoutId: ReturnType<typeof setTimeout> | undefined;

				const onFocus = () => {
					timeoutId = setTimeout(() => {
						complete(null);
					}, FOCUS_CANCEL_FALLBACK_MS);
				};

				const complete = (file: File | null) => {
					if (isResolved) {
						return;
					}
					isResolved = true;
					if (timeoutId !== undefined) {
						clearTimeout(timeoutId);
					}
					if (typeof window !== 'undefined') {
						window.removeEventListener('focus', onFocus);
					}
					input.remove();
					resolve(file);
				};

				input.addEventListener('change', () => {
					complete(input.files?.[0] ?? null);
				});
				input.addEventListener('cancel', () => {
					complete(null);
				});

				// Fallback for browsers that do not fire `cancel`
				if (typeof window !== 'undefined') {
					window.addEventListener('focus', onFocus, { once: true });
				}

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
	/** Begin browser-side font loading. Idempotent. Construction must
	 * never touch browser APIs so SSR can render while fonts stay
	 * pending; the client calls `start` after mount. */
	start: () => void;
};

/**
 * Browser-side font readiness: load the public `*.woff2` files in
 * parallel and resolve once they, and the `FontFaceSet`, are ready.
 *
 * The CSS `@font-face` rules in the application stylesheet point at
 * the same URLs, so the browser only fetches each face once: the same
 * HTTP request that primes the FontFaceSet also feeds the bytes the
 * export embeds.
 *
 * The work is deferred until `start()` so the same constructor can run
 * during SSR without throwing or producing an unhandled rejection.
 */
export function browserFontReadiness(): FontReadiness {
	let resolveReady: (fonts: ExportFonts) => void = () => undefined;
	let rejectReady: (reason: unknown) => void = () => undefined;
	const ready = new Promise<ExportFonts>((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});
	// `start()` can run before anyone subscribes; keep the deferred promise
	// settled-but-unobserved on the server-safe path.
	ready.catch(() => undefined);
	let started = false;
	return {
		ready,
		start() {
			if (started) {
				return;
			}
			started = true;
			loadBrowserExportFonts().then(resolveReady, rejectReady);
		},
	};
}

/** Fetch the two faces and prime the live FontFaceSet with them. */
async function loadBrowserExportFonts(): Promise<ExportFonts> {
	const [regular, bold] = await Promise.all([
		fetchBytes('/fonts/balsamiq-sans-neue-regular.woff2'),
		fetchBytes('/fonts/balsamiq-sans-neue-bold.woff2'),
	]);
	// Nudge the browser to load the faces synchronously with the fetch
	// above so the live canvas and any first paint using the family do
	// not stall behind the bytes-arriving event.
	await Promise.all([
		document.fonts.load(`400 16px "${SVG_EXPORT_FONT_FAMILY}"`),
		document.fonts.load(`700 16px "${SVG_EXPORT_FONT_FAMILY}"`),
	]);
	await document.fonts.ready;
	return {
		bold: { bytes: bold, mimeType: 'font/woff2' },
		regular: { bytes: regular, mimeType: 'font/woff2' },
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

/** The extension used by Kiyora PNG exports. */
export const PNG_EXTENSION = 'png';

/** The MIME type advertised for downloaded Kiyora PNG exports. */
export const PNG_MIME_TYPE = 'image/png';

/** The natural-resolution multiplier applied before rasterization. */
export const PNG_DENSITY = 2;

/**
 * Maximum pixels allowed in either dimension of the 2x PNG output.
 * Browsers refuse to allocate textures above this ceiling, so we reject
 * the export early and direct the user to SVG instead of producing a
 * broken image.
 */
export const MAX_PNG_PIXELS_PER_DIM = 8192;

/**
 * Maximum total pixels allowed in the 2x PNG output. Even when each
 * dimension is within its ceiling, very large diagrams can still
 * exceed the canvas backing-store the browser allocates, so this is a
 * belt-and-braces second guard.
 */
export const MAX_PNG_PIXELS_TOTAL = 32_000_000;

/**
 * Turn a Diagram title into a stable PNG download filename.
 *
 * Mirrors `svgFilename`'s policy: the DSL's existing slug behavior
 * derives the base name; an unusable title falls back to `diagram.png`
 * so PNG export always works.
 */
export function pngFilename(title: string): string {
	const trimmed = title.trim();
	if (trimmed.length === 0) {
		return `${FILENAME_FALLBACK}.${PNG_EXTENSION}`;
	}
	return `${slugify(trimmed)}.${PNG_EXTENSION}`;
}

/** A browser-agnostic sink for "rasterize this SVG into a PNG Blob". */
export type PngRasterizer = {
	/**
	 * Render `svg` (an XML document at the requested pixel dimensions)
	 * into a PNG `Blob`. The rasterizer is responsible for keeping the
	 * PNG's background transparent so the export works on any slide or
	 * document background.
	 *
	 * Width and height are in pixels and reflect the 2x natural size the
	 * caller wants. The promise rejects when the rasterizer cannot
	 * honor the request (e.g. image failed to load, canvas was tainted,
	 * allocation refused).
	 */
	rasterize: (options: {
		height: number;
		svg: string;
		width: number;
	}) => Promise<Blob>;
};

/**
 * The real browser PNG rasterizer: paint the SVG into an off-screen
 * `<canvas>` via an `Image`, then `toBlob('image/png')`.
 *
 * The canvas is created on demand and discarded once the blob is
 * produced so no allocation outlives a single export. The PNG is
 * emitted without a fill style on the canvas, so its background stays
 * transparent and the export works on light or dark slide backgrounds.
 */
export function browserPngRasterizer(): PngRasterizer {
	return {
		rasterize({ height, svg, width }): Promise<Blob> {
			return new Promise<Blob>((resolve, reject) => {
				if (
					typeof document === 'undefined' ||
					typeof Image === 'undefined' ||
					typeof document.createElement !== 'function'
				) {
					reject(new Error('PNG rasterization requires a browser.'));
					return;
				}
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const context = canvas.getContext('2d');
				if (context === null) {
					reject(new Error('PNG rasterization requires a 2D canvas context.'));
					return;
				}
				const blob = new Blob([svg], { type: SVG_MIME_TYPE });
				const url = URL.createObjectURL(blob);
				const image = new Image();
				image.onload = (): void => {
					context.clearRect(0, 0, width, height);
					context.drawImage(image, 0, 0, width, height);
					URL.revokeObjectURL(url);
					canvas.toBlob((png) => {
						if (png === null) {
							reject(
								new Error(
									'PNG encoding failed: the browser refused to encode the canvas.'
								)
							);
							return;
						}
						resolve(png);
					}, PNG_MIME_TYPE);
				};
				image.onerror = (): void => {
					URL.revokeObjectURL(url);
					reject(
						new Error('PNG rasterization failed: the SVG could not be decoded.')
					);
				};
				image.src = url;
			});
		},
	};
}

/**
 * Rasterize the current Scene into a transparent PNG and hand it to
 * the Downloadable.
 *
 * The PNG derives from the same portable static SVG as SVG export, so
 * it preserves the diagram rather than the canvas camera and embeds
 * the Kiyora typography. It is rasterized at 2x the renderer's natural
 * width and height for ordinary-use sharpness.
 *
 * The safety limit rejects output that exceeds `MAX_PNG_PIXELS_PER_DIM`
 * in either dimension or `MAX_PNG_PIXELS_TOTAL` overall, with an
 * actionable error that points the user at SVG instead. A rasterizer
 * failure rejects with its underlying message so the editor can route
 * it through the file-status footer.
 */
export async function downloadPng(options: {
	downloadable: Downloadable;
	/** The two faces the renderer needs so the export is self-contained. */
	fonts: ExportFonts;
	/** Browser-side rasterizer. Injected so tests can observe the call. */
	rasterizer: PngRasterizer;
	/** The current Scene to project. Caller is responsible for flushing
	 * any pending Source compile before taking this snapshot so the
	 * export reflects edits the user has just typed. */
	scene: Scene;
	/** The current Diagram title, used for the filename. */
	title: string;
}): Promise<void> {
	const { downloadable, fonts, rasterizer, scene, title } = options;
	const { height, svg, width } = renderToSvg(scene);
	const targetWidth = width * PNG_DENSITY;
	const targetHeight = height * PNG_DENSITY;
	if (
		targetWidth > MAX_PNG_PIXELS_PER_DIM ||
		targetHeight > MAX_PNG_PIXELS_PER_DIM ||
		targetWidth * targetHeight > MAX_PNG_PIXELS_TOTAL
	) {
		throw new Error(
			`PNG export is too large to rasterize safely (${targetWidth}×${targetHeight} px). Export SVG instead.`
		);
	}
	const selfContained = embedFontsInSvg(svg, fonts);
	const blob = await rasterizer.rasterize({
		height: targetHeight,
		svg: selfContained,
		width: targetWidth,
	});
	const filename = pngFilename(title);
	downloadable.save({ blob, filename });
}
