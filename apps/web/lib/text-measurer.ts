import {
  CODE_FONT_FAMILY,
  type MeasureRun,
  type Measurer,
  TEXT_FONT_FAMILY,
} from '@kiyora/model';

/**
 * The font string a run measures and draws with. The measurer and the renderer
 * both take it from here, so the width a label wraps at is the width it draws
 * at.
 */
const fontOf = (run: MeasureRun): string =>
  [
    run.italic ? 'italic' : '',
    run.bold ? 'bold' : '',
    `${run.size}px`,
    run.code ? CODE_FONT_FAMILY : TEXT_FONT_FAMILY,
  ]
    .filter((part) => part !== '')
    .join(' ');

/**
 * A canvas-backed measurer: text metrics need a DOM, and `model` must not have
 * one, so the app injects this. The canvas is made on demand, so a server render
 * with no text never reaches for `document`.
 */
export const createTextMeasurer = (): Measurer => {
  let context: CanvasRenderingContext2D | null = null;

  return (run: MeasureRun): number => {
    context ??= document.createElement('canvas').getContext('2d');
    if (context === null) {
      return 0;
    }
    context.font = fontOf(run);
    return context.measureText(run.text).width;
  };
};
