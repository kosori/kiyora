import type { Board } from '../board/schema';
import { formatNumber } from '../format';
import { type Bounds, boardBounds } from '../paint/figures';
import type { PaintImage } from '../paint/image';
import {
  type Paint,
  type PaintContext,
  type PaintPath,
  paintBoard,
} from '../paint/paint';
import { fontFamilyOf } from '../text/font';
import { type PaintText, textAnchorOf } from '../text/layout';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const INDENT = '  ';

const escapeText = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const escapeAttribute = (value: string): string =>
  escapeText(value).replaceAll('"', '&quot;');

const attrString = (pairs: [string, string | undefined][]): string =>
  pairs
    .filter((pair): pair is [string, string] => pair[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');

const attributes = (path: PaintPath): string =>
  attrString([
    ['d', path.d],
    ['fill', path.fill],
    ['stroke', path.stroke],
    [
      'stroke-width',
      path.strokeWidth === undefined
        ? undefined
        : formatNumber(path.strokeWidth),
    ],
    [
      'stroke-dasharray',
      path.dash === undefined
        ? undefined
        : path.dash.map(formatNumber).join(' '),
    ],
    ['transform', path.transform],
  ]);

const runMarkup = (run: {
  bold: boolean;
  code: boolean;
  href: string | null;
  italic: boolean;
  text: string;
}): string => {
  const span = `<tspan${attrString([
    ['font-family', fontFamilyOf(run)],
    ['font-weight', run.bold ? 'bold' : undefined],
    ['font-style', run.italic ? 'italic' : undefined],
  ])}>${escapeText(run.text)}</tspan>`;

  return run.href === null
    ? span
    : `<a href="${escapeAttribute(run.href)}" target="_blank" rel="noopener noreferrer">${span}</a>`;
};

const textMarkup = (line: PaintText, indent: string): string =>
  `${indent}<text${attrString([
    ['x', formatNumber(line.x)],
    ['y', formatNumber(line.y)],
    ['fill', line.fill],
    ['font-size', formatNumber(line.size)],
    ['text-anchor', textAnchorOf(line.align)],
    ['transform', line.transform],
  ])}>${line.runs.map(runMarkup).join('')}</text>`;

/** One raster, filling its authored box and turned with the shape it belongs to. */
const imageMarkup = (image: PaintImage, indent: string): string =>
  `${indent}<image${attrString([
    ['href', image.href],
    ['x', formatNumber(image.x)],
    ['y', formatNumber(image.y)],
    ['width', formatNumber(image.width)],
    ['height', formatNumber(image.height)],
    ['preserveAspectRatio', 'none'],
    ['opacity', image.opacity === 1 ? undefined : formatNumber(image.opacity)],
    ['transform', image.transform],
  ])}/>`;

const markup = (paint: Paint, depth: number): string[] => {
  const indent = INDENT.repeat(depth);
  const paths = paint.paths.map(
    (path) => `${indent}<path${attributes(path)}/>`
  );
  const image =
    paint.image === undefined ? [] : [imageMarkup(paint.image, indent)];
  const children = paint.children.flatMap((child) => markup(child, depth + 1));
  const text = (paint.text ?? []).map((line) => textMarkup(line, indent));

  if (paint.clip === undefined || paint.shapeId === undefined) {
    return [...paths, ...image, ...text, ...children];
  }

  const id = `clip-${paint.shapeId}`;

  return [
    ...paths,
    ...image,
    ...text,
    `${indent}<clipPath id="${id}">`,
    `${indent}${INDENT}<path d="${paint.clip}"/>`,
    `${indent}</clipPath>`,
    `${indent}<g clip-path="url(#${id})">`,
    ...children,
    `${indent}</g>`,
  ];
};

const viewBox = (bounds: Bounds | null): string =>
  bounds === null
    ? '0 0 0 0'
    : [bounds.x, bounds.y, bounds.w, bounds.h].map(formatNumber).join(' ');

/**
 * The size an artifact renders at when its caller asks for one. The height
 * follows the board's own aspect, so a wide board stays wide; a board that
 * paints nothing is a square, because it has no aspect to follow.
 */
const size = (bounds: Bounds | null, width: number | undefined): string => {
  if (width === undefined) {
    return '';
  }
  const height =
    bounds === null || bounds.w <= 0 ? width : (width * bounds.h) / bounds.w;

  return ` width="${formatNumber(width)}" height="${formatNumber(height)}"`;
};

/** What a caller may choose about the projection. The board is painted whole otherwise. */
export type ProjectionOptions = {
  /** The rendered width, in CSS pixels. Absent leaves the document to its viewer. */
  width?: number;
};

/**
 * The board as an SVG document. A board and the canvas it is painted on are the
 * only inputs, so nothing display-only can reach the artifact.
 */
export const projectBoard = (
  board: Board,
  context: PaintContext,
  options: ProjectionOptions = {}
): string => {
  const bounds = boardBounds(board);
  const lines = [
    `<svg xmlns="${SVG_NAMESPACE}"${size(bounds, options.width)} viewBox="${viewBox(bounds)}">`,
    ...markup(paintBoard(board, context), 0),
    '</svg>',
  ];

  return `${lines.join('\n')}\n`;
};

/** How much room a viewer leaves around the content it fits. */
const VIEW_PADDING_MIN = 32;
const VIEW_PADDING_RATIO = 0.06;

/**
 * The `viewBox` a viewer fits a board into: the board's content bounds with
 * breathing room around them, so nothing touches the edge of the window. An
 * empty board still has a frame to look at. The padding is a projection
 * constant, not a layout decision, so it lives here rather than in the app.
 */
export const boardViewBox = (board: Board): string => {
  const bounds = boardBounds(board);

  if (bounds === null) {
    return '0 0 1000 700';
  }

  const padding = Math.max(
    VIEW_PADDING_MIN,
    Math.max(bounds.w, bounds.h) * VIEW_PADDING_RATIO
  );

  return [
    bounds.x - padding,
    bounds.y - padding,
    bounds.w + padding * 2,
    bounds.h + padding * 2,
  ].join(' ');
};
