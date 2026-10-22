import type { Shape } from '../board/schema';
import { formatNumber } from '../format';
import { parseRuns, type Run } from './markdown';
import {
  DEFAULT_TEXT_STYLE,
  type TextAlign,
  type TextStyle,
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

/** A box text is placed inside, in board units. */
export type TextBox = {
  h: number;
  w: number;
  x: number;
  y: number;
};

/** How a box's text is drawn beyond its own style. */
export type TextBoxOptions = {
  /** Set every run bold, and measure it bold, as a table header does. */
  bold?: boolean;
  /** The point a rotation turns about; a box's own centre when absent. */
  origin?: { x: number; y: number };
  /** Degrees to turn the placed lines about `origin`. */
  rotation?: number;
  /** Where the block sits vertically; the style's own alignment when absent. */
  valign?: TextVerticalAlign;
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

const transformOf = (box: TextBox, options: TextBoxOptions) => {
  if (options.rotation === undefined || options.rotation === 0) {
    return;
  }
  const origin = options.origin ?? {
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
  };
  return `rotate(${formatNumber(options.rotation)} ${formatNumber(origin.x)} ${formatNumber(origin.y)})`;
};

/**
 * The lines text draws inside one box: wrapped by the injected measurer, placed
 * horizontally by the alignment and vertically by the vertical alignment, and
 * turned with the box when it asks. A label and a table cell both go through
 * here, so the words a person sees in a cell wrap exactly as they would in a
 * label of the same width.
 */
export const textInBox = (
  box: TextBox,
  source: string,
  style: TextStyle,
  measure: Measurer,
  fill: string,
  options: TextBoxOptions = {}
): PaintText[] => {
  if (source === '') {
    return [];
  }

  const left = box.x + TEXT_PADDING;
  const top = box.y + TEXT_PADDING;
  const width = box.w - TEXT_PADDING * 2;
  const height = box.h - TEXT_PADDING * 2;
  if (width <= 0 || height <= 0) {
    return [];
  }

  const parsed = parseRuns(source);
  const runs =
    options.bold === true
      ? parsed.map((run) => ({ ...run, bold: true }))
      : parsed;
  const lines = wrapRuns(runs, width, style.size, measure);
  if (lines.length === 0) {
    return [];
  }

  const lineHeight = style.size * TEXT_LINE_HEIGHT;
  const block = lines.length * lineHeight;
  const valign = options.valign ?? style.valign;
  const blockTop = topOf(top, height, block, valign);
  const transform = transformOf(box, options);

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
  const style = shape.textStyle ?? DEFAULT_TEXT_STYLE;

  return textInBox(shape, shape.text ?? '', style, measure, fill, {
    ...(shape.rotation === 0
      ? {}
      : {
          origin: { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 },
          rotation: shape.rotation,
        }),
    // A text shape is top-aligned by nature: it is words that belong to nothing
    // else, with no box to sit inside, so its vertical alignment is always the
    // top of its own frame and never the authored `valign` a shape label carries.
    valign: shape.kind === 'text' ? 'top' : style.valign,
  });
};
