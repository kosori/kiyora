import { type Run, sameRunStyle } from './markdown';

/**
 * Text measurement needs a DOM and `model` must not have one, so it is injected.
 * The app hands over a canvas-backed measurer; a test hands over a deterministic
 * fake. Both the canvas and the export wrap through the same one, so the file
 * matches what was on screen.
 */
export type Measurer = (run: MeasureRun) => number;

/** One measured span: the text, and everything that changes how wide it is. */
export type MeasureRun = {
  bold: boolean;
  code: boolean;
  italic: boolean;
  size: number;
  text: string;
};

/** One line a label wraps into, with the width it measured. */
export type TextLine = {
  runs: Run[];
  width: number;
};

type Token = {
  hard: boolean;
  run: Run;
  text: string;
};

const tokenize = (runs: readonly Run[]): Token[] => {
  const tokens: Token[] = [];

  for (const source of runs) {
    let buffer = '';
    let space = false;
    const flush = () => {
      if (buffer !== '') {
        tokens.push({ hard: false, run: source, text: buffer });
        buffer = '';
      }
    };

    for (const char of source.text) {
      if (char === '\n') {
        flush();
        tokens.push({ hard: true, run: source, text: '' });
        space = false;
        continue;
      }
      const next = /\s/.test(char);
      if (buffer !== '' && next !== space) {
        flush();
      }
      space = next;
      buffer += char;
    }
    flush();
  }

  return tokens;
};

const widthOf = (token: Token, size: number, measure: Measurer): number =>
  measure({
    bold: token.run.bold,
    code: token.run.code,
    italic: token.run.italic,
    size,
    text: token.text,
  });

/**
 * The lines a label wraps into inside `maxWidth`, measured by `measure` at
 * `size`. Words break at whitespace, a word too wide for the box keeps its own
 * line rather than being cut, and a hard newline always breaks. Empty text has
 * no lines.
 */
export const wrapRuns = (
  runs: readonly Run[],
  maxWidth: number,
  size: number,
  measure: Measurer
): TextLine[] => {
  const lines: TextLine[] = [];
  let lineRuns: Run[] = [];
  let lineWidth = 0;
  let pending: Token | null = null;

  const append = (token: Token): void => {
    const last = lineRuns.at(-1);
    if (last !== undefined && sameRunStyle(last, token.run)) {
      last.text += token.text;
    } else {
      lineRuns.push({ ...token.run, href: token.run.href, text: token.text });
    }
  };

  const breakLine = (): void => {
    if (lineRuns.length > 0) {
      lines.push({ runs: lineRuns, width: lineWidth });
    }
    lineRuns = [];
    lineWidth = 0;
    pending = null;
  };

  for (const token of tokenize(runs)) {
    if (token.hard) {
      breakLine();
      continue;
    }
    const width = widthOf(token, size, measure);
    const space = pending === null ? 0 : widthOf(pending, size, measure);

    if (lineRuns.length > 0 && lineWidth + space + width > maxWidth) {
      breakLine();
    }
    if (pending !== null && lineRuns.length > 0) {
      append(pending);
      lineWidth += space;
    }
    pending = token.text.trim() === '' ? token : null;
    if (pending === null) {
      append(token);
      lineWidth += width;
    }
  }
  breakLine();

  return lines;
};
