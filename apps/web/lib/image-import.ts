import {
  fitImageSize,
  IMAGE_FILE_LIMIT_BYTES,
  type ImageFile,
  type ImageMime,
  imageMimeOf,
} from '@kiyora/model';

/**
 * Importing a raster: the DOM half of placing an image. The file input hands in
 * a `File`, this module checks that its bytes really are a PNG or JPEG, decodes
 * it, downscales it once, and hands the engine a content-hashed entry. `model`
 * stays DOM-free; only the decode, the canvas and the digest live here.
 */

/** The most the placed box may span, in board units, before the picture is scaled to fit. */
export const IMAGE_PLACEMENT_SIDE = 480;

/**
 * Thrown when a pick is not a raster this build may carry, or is too heavy after
 * downscaling. `reason` is the sentence the chrome shows, so a refusal names
 * what to do rather than failing silently.
 */
export class ImageImportRefusal extends Error {
  readonly reason: string;

  constructor(reason: string, options?: ErrorOptions) {
    super(`Image refused: ${reason}`, options);
    this.name = 'ImageImportRefusal';
    this.reason = reason;
  }
}

/** One imported raster: the entry the board stores, hashed, and its pixel size. */
export type ImportedImage = {
  file: ImageFile;
  /** The content hash the board's `files` map is keyed by. */
  fileId: string;
  /** The stored raster's size, so the first placement keeps its aspect. */
  height: number;
  width: number;
};

/** The JPEG quality a downscaled photo is written at: visually lossless, a third of the bytes. */
const JPEG_QUALITY = 0.85;

/** The bytes a base64 data URL carries, decoded without a network or a Blob. */
const bytesOfDataURL = (dataURL: string): Uint8Array<ArrayBuffer> => {
  const encoded = dataURL.slice(dataURL.indexOf(',') + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

/** The lowercase hex of a digest, which is the file id a raster is stored under. */
const hexOf = (digest: ArrayBuffer): string =>
  [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/** The content hash of the stored bytes, so the same picture is stored once. */
const hashOf = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  if (crypto.subtle === undefined) {
    throw new ImageImportRefusal('this browser cannot fingerprint the image');
  }

  return hexOf(await crypto.subtle.digest('SHA-256', bytes));
};

/** The canvas a decoded raster is drawn into, refusing when the browser offers none. */
const canvasOf = (width: number, height: number): CanvasRenderingContext2D => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (context === null) {
    throw new ImageImportRefusal('the browser offered no 2D canvas');
  }

  return context;
};

/** Decodes `file` into a bitmap, refusing a payload the browser cannot read. */
const decode = async (file: File): Promise<ImageBitmap> => {
  try {
    return await createImageBitmap(file);
  } catch (error) {
    throw new ImageImportRefusal('the browser could not decode this image', {
      cause: error,
    });
  }
};

/**
 * Imports one picked file as a board raster. The signature, not the file name or
 * the input's claim, decides the type; the picture is downscaled to the import
 * ceiling before it is encoded, so a camera photo lands at a size the board can
 * carry; and the stored bytes are hashed, so importing the same picture twice
 * reuses one payload.
 */
export const importImage = async (file: File): Promise<ImportedImage> => {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const mime: ImageMime | null = imageMimeOf(head);

  if (mime === null) {
    throw new ImageImportRefusal('only PNG and JPEG images can be placed');
  }

  const bitmap = await decode(file);
  const size = fitImageSize({
    height: bitmap.height,
    width: bitmap.width,
  });
  const context = canvasOf(size.width, size.height);

  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const dataURL = context.canvas.toDataURL(
    mime,
    mime === 'image/jpeg' ? JPEG_QUALITY : undefined
  );
  const bytes = bytesOfDataURL(dataURL);

  if (bytes.length > IMAGE_FILE_LIMIT_BYTES) {
    throw new ImageImportRefusal(
      `the picture is ${bytes.length} bytes after scaling, over the ${IMAGE_FILE_LIMIT_BYTES}-byte cap`
    );
  }

  return {
    file: { bytes: bytes.length, dataURL, mime },
    fileId: await hashOf(bytes),
    height: size.height,
    width: size.width,
  };
};
