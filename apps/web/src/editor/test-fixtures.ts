import type { ExportFonts } from './io/io';

/**
 * A deterministic `ExportFonts` fixture used by tests that need to
 * satisfy the io boundary's font payload without coupling to the real
 * browser FontFaceSet.
 *
 * The bytes are arbitrary small arrays; tests that assert on the
 * embedded data URIs supply their own bytes via `downloadSvg` directly.
 */
export const EXPORT_FONTS_FIXTURE: ExportFonts = {
	bold: { bytes: new Uint8Array([4, 5, 6]), mimeType: 'font/woff2' },
	regular: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'font/woff2' },
};
