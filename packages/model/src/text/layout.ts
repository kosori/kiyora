import type { Shape } from '../board/schema';
import { formatNumber } from '../format';
import { parseRuns, type Run } from './markdown';
import {
  DEFAULT_TEXT_STYLE,
  type TextAlign,
  type TextVerticalAlign,
} from './style';
import { type Measurer, wrapRuns } from './wrap';

/** The inset between a shape's edge and the label it carries, in board units. */
export const TEXT_PADDING = 8;

/** A line's height as a multiple of its size. */
export const TEXT_LINE_HEIGHT = 1.3;

/** How far a line's baseline sits below its top, as a multiple of its size. */
export const TEXT_ASCENT = 0.8;

/** The SVG text anchor an alignment draws with. */
export type TextAnchor = 'end' | 'middle' | 'start';

/** The anchor an alignment places its line at. */
export const textAnchorOf = (align: TextAlign): TextAnchor => {
  if (align === 'left') {
    return 'start';
  }
  return align === 'right' ? 'end' : 'middle';
};

/** One line of a label, placed in board coordinates and ready to draw. */
export type PaintText = {
  align: TextAlign;
  fill: string;
  runs: Run[];
  size: number;
  transform?: string;
  x: number;
  y: number;
};

const anchorX = (left: number, width: number, align: TextAlign): number => {
  if (align === 'left') {
    return left;
  }
  return align === 'right' ? left + width : left + width / 2;
};

const topOf = (
  top: number,
  height: number,
  block: number,
  valign: TextVerticalAlign
): number => {
  if (valign === 'top') {
    return top;
  }
  return valign === 'bottom'
    ? top + height - block
    : top + (height - block) / 2;
};

const rotationOf = (shape: Shape): string | undefined => {
  if (shape.rotation === 0) {
    return undefined;
  }
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  return `rotate(${formatNumber(shape.rotation)} ${formatNumber(cx)} ${formatNumber(cy)})`;
};

/**
 * The lines a shape's label draws, wrapped by the injected measurer and placed
 * inside the shape: horizontally by the alignment, vertically by the vertical
 * alignment, and turned with the shape when it is rotated. A shape with no text,
 * or no room for any, has no label.
 */
export const textOf = (
  shape: Shape,
  measure: Measurer,
  fill: string
): PaintText[] => {
  const source = shape.text;
  if (source === undefined || source === '') {
    return [];
  }

  const style = shape.textStyle ?? DEFAULT_TEXT_STYLE;
  const left = shape.x + TEXT_PADDING;
  const top = shape.y + TEXT_PADDING;
  const width = shape.w - TEXT_PADDING * 2;
  const height = shape.h - TEXT_PADDING * 2;
  if (width <= 0 || height <= 0) {
    return [];
  }

  const lines = wrapRuns(parseRuns(source), width, style.size, measure);
  if (lines.length === 0) {
    return [];
  }

  const lineHeight = style.size * TEXT_LINE_HEIGHT;
  const block = lines.length * lineHeight;
  // A text shape is top-aligned by nature: it is words that belong to nothing
  // else, with no box to sit inside, so its vertical alignment is always the
  // top of its own frame and never the authored `valign` a shape label carries.
  const valign = shape.kind === 'text' ? 'top' : style.valign;
  const blockTop = topOf(top, height, block, valign);
  const transform = rotationOf(shape);

  return lines.map((line, index) => ({
    align: style.align,
    fill,
    runs: line.runs,
    size: style.size,
    ...(transform === undefined ? {} : { transform }),
    x: anchorX(left, width, style.align),
    y: blockTop + index * lineHeight + style.size * TEXT_ASCENT,
  }));
};
