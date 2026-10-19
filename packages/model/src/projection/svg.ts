import type { Board } from '../board/schema';
import { formatNumber } from '../format';
import { boardBounds } from '../paint/figures';
import {
  type Paint,
  type PaintContext,
  type PaintPath,
  paintBoard,
} from '../paint/paint';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const INDENT = '  ';

const attributes = (path: PaintPath): string => {
  const pairs: [string, string | undefined][] = [
    ['d', path.d],
    ['fill', path.fill],
    ['stroke', path.stroke],
    [
      'stroke-width',
      path.strokeWidth === undefined
        ? undefined
        : formatNumber(path.strokeWidth),
    ],
  ];

  return pairs
    .filter((pair): pair is [string, string] => pair[1] !== undefined)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');
};

const markup = (paint: Paint, depth: number): string[] => {
  const indent = INDENT.repeat(depth);
  const paths = paint.paths.map(
    (path) => `${indent}<path${attributes(path)}/>`
  );
  const children = paint.children.flatMap((child) => markup(child, depth + 1));

  if (paint.clip === undefined || paint.shapeId === undefined) {
    return [...paths, ...children];
  }

  const id = `clip-${paint.shapeId}`;

  return [
    ...paths,
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
