import type { ImageFile } from '../board/image';
import type { ImageShape } from '../board/schema';
import { formatNumber } from '../format';
import type { Paint, PaintPath } from './paint';

/**
 * The raster one image shape draws: the payload from the board's files, filling
 * the authored box, with the authored rotation already expressed as a transform.
 * It lives beside the walker so the walker stays the one place that decides
 * paint order, and so the payload lookup stays one small function.
 */
export type PaintImage = {
  href: string;
  height: number;
  opacity: number;
  transform?: string;
  width: number;
  x: number;
  y: number;
};

/**
 * Paints one image into the authored box. The fallback path is the box a
 * missing payload leaves behind, so a board opened without its bytes still
 * shows where the picture belongs instead of an empty hole.
 */
export const paintImage = (
  shape: ImageShape,
  file: ImageFile | undefined,
  box: PaintPath
): Paint => {
  if (file === undefined) {
    return { children: [], paths: [box] };
  }

  return {
    children: [],
    image: {
      height: shape.h,
      href: file.dataURL,
      opacity: shape.opacity,
      ...(shape.rotation === 0
        ? {}
        : {
            transform: `rotate(${formatNumber(shape.rotation)} ${formatNumber(shape.x + shape.w / 2)} ${formatNumber(shape.y + shape.h / 2)})`,
          }),
      width: shape.w,
      x: shape.x,
      y: shape.y,
    },
    paths: [],
  };
};
