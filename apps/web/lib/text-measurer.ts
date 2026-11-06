import { fontFamilyOf, type MeasureRun, type Measurer } from '@kiyora/model';

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
    fontFamilyOf(run),
  ]
    .filter((part) => part !== '')
    .join(' ');

/**
 * A canvas-backed measurer: text metrics need a DOM, and `model` must not have
 * one, so the app injects this. The canvas is made on demand, and the attempt is
 * remembered: a browser that will not grant a context is reported once rather
 * than retried per token. Measuring outside a browser throws a descriptive
 * error, because a made-up width would wrap labels at a width they are not
 * drawn at.
 */
export const createTextMeasurer = (): Measurer => {
  let context: CanvasRenderingContext2D | null = null;
  let attempted = false;
  let lastFont: string | null = null;

  return (run: MeasureRun): number => {
    if (!attempted) {
      attempted = true;
      if (typeof document === 'undefined') {
        throw new Error(
          'text measurement needs a DOM: document is undefined in this environment'
        );
      }
      context = document.createElement('canvas').getContext('2d');
    }
    if (context === null) {
      throw new Error('text measurement needs a 2D canvas context');
    }

    const font = fontOf(run);
    if (font !== lastFont) {
      context.font = font;
      lastFont = font;
    }

    return context.measureText(run.text).width;
  };
};
