import type { Board } from '../board/schema';
import { formatNumber } from '../format';
import { boardBounds } from '../paint/figures';
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

const markup = (paint: Paint, depth: number): string[] => {
  const indent = INDENT.repeat(depth);
  const paths = paint.paths.map(
    (path) => `${indent}<path${attributes(path)}/>`
  );
  const children = paint.children.flatMap((child) => markup(child, depth + 1));
  const text = (paint.text ?? []).map((line) => textMarkup(line, indent));

  if (paint.clip === undefined || paint.shapeId === undefined) {
    return [...paths, ...text, ...children];
  }

  const id = `clip-${paint.shapeId}`;

  return [
    ...paths,
    ...text,
    `${indent}<clipPath id="${id}">`,
    `${indent}${INDENT}<path d="${paint.clip}"/>`,
    `${indent}</clipPath>`,
    `${indent}<g clip-path="url(#${id})">`,
    ...children,
    `${indent}</g>`,
  ];
};

const viewBox = (board: Board): string => {
  const bounds = boardBounds(board);

  return bounds === null
    ? '0 0 0 0'
    : [bounds.x, bounds.y, bounds.w, bounds.h].map(formatNumber).join(' ');
};

/**
 * The board as an SVG document. A board and the canvas it is painted on are the
 * only inputs, so nothing display-only can reach the artifact.
 */
export const projectBoard = (board: Board, context: PaintContext): string => {
  const lines = [
    `<svg xmlns="${SVG_NAMESPACE}" viewBox="${viewBox(board)}">`,
    ...markup(paintBoard(board, context), 0),
    '</svg>',
  ];

  return `${lines.join('\n')}\n`;
};
