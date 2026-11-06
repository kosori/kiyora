import { selectedShapes } from '@kiyora/editor';
import {
  type Board,
  CANVAS_ENTRY,
  exportBoardSvg,
  type Measurer,
  type Theme,
} from '@kiyora/model';
import { boardFileName } from './board-file';
import { downloadBlob } from './download';
import { iconSetFor } from './icon-set';

/**
 * The board as a raster. Rasterising needs a real canvas, and `model` must stay
 * DOM-free, so the pixel work lives here while the drawing comes from `model`'s
 * own SVG export: one artifact path, so the raster and the vector file cannot
 * disagree about what the board is.
 */

/** The extension a raster export wears. */
export const PNG_FILE_EXTENSION = '.png';

/** The scales a raster export offers, exact multiples of the board's own size. */
export const PNG_SCALES = [1, 2, 4] as const;

/** One scale factor a raster export may take. */
export type PngScale = (typeof PNG_SCALES)[number];

/** What a raster carries: the whole board, or only the selection. */
export type PngTarget = 'board' | 'selection';

/** What a raster leaves around the drawing. */
export type PngBackground = 'solid' | 'transparent';

/**
 * One raster export: the bytes, and whether the vendored faces were missing.
 * `fallbackText` reports that labels left in a fallback face, so the surface can
 * say the image is not quite what the screen showed instead of staying silent.
 */
export type PngExport = {
  blob: Blob;
  fallbackText: boolean;
};

/**
 * What a PNG export lets a caller choose. The board and its measurer are the
 * rest. The theme is an argument rather than the app's own, so a board drawn on
 * a light canvas can leave as a dark image, and the two can differ.
 */
export type PngExportOptions = {
  background: PngBackground;
  scale: PngScale;
  theme: Theme;
};

/**
 * The colour a solid background paints, per theme: the canvas the palette names,
 * paired with the ink drawn on it, so the raster and the page cannot disagree
 * about what the board was drawn on.
 */
export const PNG_BACKGROUND: Record<Theme, string> = {
  dark: CANVAS_ENTRY.dark,
  light: CANVAS_ENTRY.light,
};

/**
 * The most pixels one raster may hold. A canvas past this does not fail on its
 * own: it hands back an empty or stripped image, so the export refuses first and
 * reports, rather than writing a file that looks like the board and is not.
 */
export const PNG_EXPORT_LIMIT_PIXELS = 4096 * 4096;

/** The longest side a raster may take, because a canvas has a hard one of its own. */
export const PNG_EXPORT_LIMIT_SIDE = 8192;

/** Thrown when a board cannot leave the app as a PNG. `reason` names what stopped it. */
export class PngExportRefusal extends Error {
  readonly reason: string;

  constructor(reason: string, options?: ErrorOptions) {
    super(`PNG export refused: ${reason}`, options);
    this.name = 'PngExportRefusal';
    this.reason = reason;
  }
}

/** The faces the projection names, as the page serves them. */
const FONT_FACES = [
  {
    family: 'Balsamiq Sans Neue',
    file: 'balsamiq-sans-neue-regular.woff2',
    weight: 400,
  },
  {
    family: 'Balsamiq Sans Neue',
    file: 'balsamiq-sans-neue-bold.woff2',
    weight: 700,
  },
  { family: 'Geist Mono', file: 'geist-mono-regular.woff2', weight: 400 },
  { family: 'Geist Mono', file: 'geist-mono-bold.woff2', weight: 700 },
] as const;

/** The width and height a document's own viewBox names, or `null` when it carries none. */
const viewBoxOf = (svg: string): { h: number; w: number } | null => {
  const parts = /viewBox="([^"]*)"/
    .exec(svg)?.[1]
    ?.trim()
    .split(/\s+/)
    .map(Number);

  if (parts === undefined || parts.length !== 4) {
    return null;
  }
  if (parts.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return { h: parts[3] ?? 0, w: parts[2] ?? 0 };
};

/**
 * The pixel box a raster takes at `scale`, read from the export's own viewBox so
 * the raster and the vector file cannot disagree about the crop. It refuses an
 * empty drawing and a box past the cap before a canvas exists, so a failure is
 * reported rather than half-written.
 */
export const rasterBox = (
  svg: string,
  scale: number
): { height: number; width: number } => {
  const viewBox = viewBoxOf(svg);

  if (viewBox === null) {
    throw new PngExportRefusal('the projection carries no crop');
  }

  const width = Math.round(viewBox.w * scale);
  const height = Math.round(viewBox.h * scale);

  if (width < 1 || height < 1) {
    throw new PngExportRefusal('the board draws nothing to export');
  }
  if (width > PNG_EXPORT_LIMIT_SIDE || height > PNG_EXPORT_LIMIT_SIDE) {
    throw new PngExportRefusal(
      `the image is ${width}×${height}, past the ${PNG_EXPORT_LIMIT_SIDE}-pixel side cap`
    );
  }
  if (width * height > PNG_EXPORT_LIMIT_PIXELS) {
    throw new PngExportRefusal(
      `the image is ${width}×${height} pixels, past the ${PNG_EXPORT_LIMIT_PIXELS}-pixel cap`
    );
  }

  return { height, width };
};

/** The bytes a `btoa` will take, without a `Blob` in the way. */
const base64Of = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

/** The face rules a raster carries, and whether they are missing. */
type Faces = { fallback: boolean; markup: string };

/**
 * The face rules the raster needs and the exported file must not carry. An
 * `<img>` renders an SVG with no reach into the page's stylesheets, so without
 * these a label would leave in a fallback face while the screen shows the
 * vendored one. The fetch is for the app's own asset; when it fails the raster
 * still leaves, with the fallback face, because a missing face must not cost the
 * person their image. The failure is not silent: `fallback` travels to the
 * surface so it can say the labels changed face.
 */
const facesMarkup = async (): Promise<Faces> => {
  try {
    const rules = await Promise.all(
      FONT_FACES.map(async ({ family, file, weight }) => {
        const response = await fetch(`/fonts/${file}`);
        if (!response.ok) {
          throw new Error(`the face ${file} would not load`);
        }
        const base64 = base64Of(new Uint8Array(await response.arrayBuffer()));
        return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${base64}) format('woff2')}`;
      })
    );

    return { fallback: false, markup: `<style>${rules.join('')}</style>` };
  } catch {
    return { fallback: true, markup: '' };
  }
};

/**
 * The projection with the page's faces carried inside it, so the raster sets the
 * same text. Unanchored, so an XML prolog or leading whitespace cannot make the
 * match miss and drop the rules: the first root `<svg ...>` is still the first.
 */
const withFaces = (svg: string, markup: string): string =>
  markup === '' ? svg : svg.replace(/(<svg\b[^>]*>)/, `$1${markup}`);

/** Decodes one SVG document into an image the canvas can draw. */
const loadImage = (svg: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new PngExportRefusal('the projection would not decode'));
    };
    image.src = url;
  });

/** The canvas as PNG bytes, refusing when the browser writes nothing. */
const toPng = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new PngExportRefusal('the canvas wrote no image'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });

/** The canvas as PNG bytes, converting a synchronous `toBlob` throw to a refusal. */
const pngOf = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  try {
    return await toPng(canvas);
  } catch (thrown) {
    throw thrown instanceof PngExportRefusal
      ? thrown
      : new PngExportRefusal('the canvas would not write an image', {
          cause: thrown,
        });
  }
};

/**
 * The SVG export as PNG bytes: drawn at the chosen scale, over the chosen
 * background, in the chosen theme. The size comes from the export's own viewBox
 * and the cap is checked before a canvas exists, so an over-large board reports
 * instead of writing a cropped file. `fallbackText` reports a raster whose
 * labels had to leave in a fallback face.
 */
export const rasteriseBoard = async (
  svg: string,
  options: PngExportOptions
): Promise<PngExport> => {
  const { width, height } = rasterBox(svg, options.scale);
  const faces = await facesMarkup();
  const image = await loadImage(withFaces(svg, faces.markup));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new PngExportRefusal('the browser offered no 2D canvas');
  }

  if (options.background === 'solid') {
    context.fillStyle = PNG_BACKGROUND[options.theme];
    context.fillRect(0, 0, width, height);
  }

  try {
    context.drawImage(image, 0, 0, width, height);
  } catch (thrown) {
    throw new PngExportRefusal('the projection would not draw', {
      cause: thrown,
    });
  }

  return { blob: await pngOf(canvas), fallbackText: faces.fallback };
};

/** The board a PNG export carries: the whole board, or only the selection as a board. */
export const pngBoard = (
  board: Board,
  selection: readonly string[],
  target: PngTarget
): Board =>
  target === 'board'
    ? board
    : { ...board, shapes: selectedShapes(board, selection) };

/**
 * The board as the bytes a person downloads: projected through `model`'s export,
 * then rasterised. One artifact path, so the PNG and the SVG cannot disagree.
 * The export carries whether the vendored faces were missing, so the surface can
 * say so.
 */
export const exportBoardPng = async (
  board: Board,
  options: PngExportOptions,
  measure?: Measurer
): Promise<PngExport> => {
  const icons = await iconSetFor(board);
  const svg = exportBoardSvg(board, {
    files: board.files,
    icons,
    measure,
    theme: options.theme,
  });

  return await rasteriseBoard(svg, options);
};

/** The scale a copied picture takes: the selection's own bounds, once. */
export const COPY_PNG_SCALE: PngScale = 1;

/** Puts `blob` on the system clipboard as a PNG, refusing where the browser will not. */
export const writePngToClipboard = async (blob: Blob): Promise<void> => {
  if (
    typeof ClipboardItem === 'undefined' ||
    navigator.clipboard?.write === undefined
  ) {
    throw new PngExportRefusal('this browser cannot copy an image');
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } catch (thrown) {
    throw new PngExportRefusal('the browser refused the clipboard', {
      cause: thrown,
    });
  }
};

/**
 * The selection as a PNG on the system clipboard. It goes through the same
 * export path as a downloaded raster: cropped to the selection's own bounds,
 * transparent, at one pixel per board unit, so the copied picture is exactly
 * what was selected.
 */
export const copySelectionPng = async (
  board: Board,
  selection: readonly string[],
  measure?: Measurer
): Promise<PngExport> => {
  if (selection.length === 0) {
    throw new PngExportRefusal('the board draws nothing to copy');
  }
  const exported = await exportBoardPng(
    pngBoard(board, selection, 'selection'),
    {
      background: 'transparent',
      scale: COPY_PNG_SCALE,
      theme: board.settings.theme,
    },
    measure
  );
  await writePngToClipboard(exported.blob);

  return exported;
};

/** Writes a raster out as one PNG download, under the board's own name. */
export const saveBoardPng = (blob: Blob, title: string): void => {
  const url = URL.createObjectURL(blob);
  downloadBlob(url, boardFileName(title, PNG_FILE_EXTENSION));
};
