import { z } from 'zod';

/**
 * The raster types a board may carry. Both are inert once embedded: a browser
 * decodes them into pixels and nothing in either format can run code. Anything
 * with an active payload — SVG, HTML, a remote reference — is refused by this
 * list and by the export sanitizer that reads it.
 */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

/** The raster type a board's file carries. */
export const imageMimeSchema = z.enum(IMAGE_MIME_TYPES);

/** The raster type a board's file carries. */
export type ImageMime = z.infer<typeof imageMimeSchema>;

/**
 * The most decoded bytes one image may hold. Downscaling on import makes this
 * a cap on what the board carries rather than on the camera that produced the
 * file: a phone photo lands well under it and the board file's own 8 MiB cap
 * stays the outer bound on all of them together.
 */
export const IMAGE_FILE_LIMIT_BYTES = 2 * 1024 * 1024;

/**
 * The longest side an imported raster keeps, in pixels. A camera photo arrives
 * at twelve megapixels or more; the board needs the picture, not the sensor.
 * Downscaling to this side before encoding keeps every stored image inside the
 * per-image cap and the board close to its file cap.
 */
export const IMAGE_MAX_SIDE = 2048;

const DATA_URL = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * One raster inside the board file: the encoded bytes, the type they decode as,
 * and their decoded size. The size travels with the payload so the per-image
 * cap is checked without decoding the data URL, and so a person can see what one
 * picture costs the board.
 */
export const imageFileSchema = z
  .object({
    bytes: z.number().int().positive().max(IMAGE_FILE_LIMIT_BYTES),
    dataURL: z.string().regex(DATA_URL, {
      message: 'is not a base64 PNG or JPEG data URL',
    }),
    mime: imageMimeSchema,
  })
  .refine((file) => file.dataURL.startsWith(`data:${file.mime};base64,`), {
    message: 'does not match the type it declares',
  });

/** One raster inside the board file. */
export type ImageFile = z.infer<typeof imageFileSchema>;

/** The board's files, keyed by the content hash that names them. */
export const filesSchema = z.record(z.string().min(1), imageFileSchema);

/** The board's files, keyed by the content hash that names them. */
export type BoardFiles = z.infer<typeof filesSchema>;

/** The PNG signature: eight bytes no other accepted raster starts with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The JPEG signature: the start-of-image marker and the first segment. */
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

/**
 * The raster type `bytes` actually are, or `null` when they are neither PNG nor
 * JPEG. The file input's own type is a claim; this reads the signature, so a
 * renamed GIF or an SVG wearing a `.png` name is refused rather than embedded.
 */
export const imageMimeOf = (bytes: Uint8Array): ImageMime | null => {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  return null;
};

/**
 * The size a raster keeps when its longest side is held to `maxSide`. It never
 * grows a picture: a small image keeps the pixels its author chose. Rounded to
 * whole pixels, and never below one, so a degenerate dimension still yields a
 * raster a canvas will draw.
 */
export const fitImageSize = (
  size: { height: number; width: number },
  maxSide: number = IMAGE_MAX_SIDE
): { height: number; width: number } => {
  const longest = Math.max(size.width, size.height);
  const scale = longest > maxSide ? maxSide / longest : 1;

  return {
    height: Math.max(1, Math.round(size.height * scale)),
    width: Math.max(1, Math.round(size.width * scale)),
  };
};

/** Whether a board carries at least one raster, so a store can refuse it before a write. */
export const hasImageFiles = (board: {
  files: Readonly<Record<string, unknown>>;
}): boolean => Object.keys(board.files).length > 0;
