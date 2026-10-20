/**
 * The markdown subset a label understands, exactly: bold, italic, inline code
 * and links. It is parsed into runs at render time and never stored, so a label
 * is one string and the board carries no span model.
 *
 * A link's target is the one place a hostile document attacks, so every target
 * is sanitised here, before a run can carry it, and the canvas and the export
 * both receive only a safe value — or a plain run with no link at all.
 */

/** One styled span of a label. */
export type Run = {
  bold: boolean;
  code: boolean;
  href: string | null;
  italic: boolean;
  text: string;
};

const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * The target a link may point at, or `null` when it may not. Only `http`,
 * `https` and `mailto` survive: a script scheme, a data URI, a scheme-object,
 * or a relative target with no scheme is refused, because a board is a saved
 * document and a label must not be able to run anything.
 */
export const sanitizeHref = (raw: string): string | null => {
  const url = raw.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (scheme === null) {
    return null;
  }
  return SAFE_SCHEMES.includes(`${scheme[1]?.toLowerCase()}:`) ? url : null;
};

type Style = Partial<Pick<Run, 'bold' | 'code' | 'href' | 'italic'>>;

const run = (text: string, style: Style = {}): Run => ({
  bold: style.bold ?? false,
  code: style.code ?? false,
  href: style.href ?? null,
  italic: style.italic ?? false,
  text,
});

const sameStyle = (a: Run, b: Run): boolean =>
  a.bold === b.bold &&
  a.code === b.code &&
  a.href === b.href &&
  a.italic === b.italic;

/** Whether two runs share a style, whatever their text, so they can be joined. */
export const sameRunStyle = sameStyle;

const merge = (runs: Run[]): Run[] => {
  const merged: Run[] = [];
  for (const next of runs) {
    const last = merged.at(-1);
    if (last !== undefined && sameStyle(last, next)) {
      last.text += next.text;
    } else {
      merged.push(next);
    }
  }
  return merged;
};

/** Whether an emphasis marker at `index` may open, so underscores inside a word stay literal. */
const canOpen = (source: string, index: number, width: number): boolean => {
  const before = index === 0 ? '' : (source[index - 1] ?? '');
  const after = source[index + width];
  const startsWord = before === '' || /\s/.test(before);
  const carriesWord = after !== undefined && !/\s/.test(after);
  return startsWord && carriesWord;
};

type Parsed = {
  next: number;
  run: Run;
};

const parseDelimited = (
  source: string,
  index: number,
  marker: string,
  style: Style
): Parsed | null => {
  const end = source.indexOf(marker, index + marker.length);
  if (end <= index + marker.length) {
    return null;
  }
  return {
    next: end + marker.length,
    run: run(source.slice(index + marker.length, end), style),
  };
};

const parseCode = (source: string, index: number): Parsed | null => {
  const end = source.indexOf('`', index + 1);
  if (end <= index + 1) {
    return null;
  }
  return {
    next: end + 1,
    run: run(source.slice(index + 1, end), { code: true }),
  };
};

const findUrlEnd = (source: string, from: number): number => {
  let depth = 0;
  for (let index = from; index < source.length; index += 1) {
    const char = source[index];
    if (char === ' ' || char === '\n') {
      return -1;
    }
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      if (depth === 0) {
        return index;
      }
      depth -= 1;
    }
  }
  return -1;
};

const parseLink = (source: string, index: number): Parsed | null => {
  const labelEnd = source.indexOf(']', index + 1);
  if (labelEnd <= index || source[labelEnd + 1] !== '(') {
    return null;
  }
  const urlEnd = findUrlEnd(source, labelEnd + 2);
  if (urlEnd <= labelEnd + 1) {
    return null;
  }
  const label = source.slice(index + 1, labelEnd);
  const href = sanitizeHref(source.slice(labelEnd + 2, urlEnd));
  return { next: urlEnd + 1, run: run(label, href === null ? {} : { href }) };
};

const parseAt = (source: string, index: number): Parsed | null => {
  const char = source[index];
  if (char === '`') {
    return parseCode(source, index);
  }
  if (char === '[') {
    return parseLink(source, index);
  }
  if (char !== '*' && char !== '_') {
    return null;
  }
  const triple = char.repeat(3);
  const double = char.repeat(2);
  if (source.startsWith(triple, index) && canOpen(source, index, 3)) {
    return parseDelimited(source, index, triple, { bold: true, italic: true });
  }
  if (source.startsWith(double, index) && canOpen(source, index, 2)) {
    return parseDelimited(source, index, double, { bold: true });
  }
  if (canOpen(source, index, 1)) {
    return parseDelimited(source, index, char, { italic: true });
  }
  return null;
};

/** The runs a label's source is made of: plain text, bold, italic, code and links. */
export const parseRuns = (source: string): Run[] => {
  const runs: Run[] = [];
  let index = 0;
  while (index < source.length) {
    const parsed = parseAt(source, index);
    if (parsed === null) {
      runs.push(run(source[index] ?? ''));
      index += 1;
    } else {
      runs.push(parsed.run);
      index = parsed.next;
    }
  }
  return merge(runs);
};

/**
 * Whether a caret sits inside an inline code span, by the parser's own rules.
 * The label overlay is one plain field, so this is how it knows to set the
 * field in the code face without a second backtick grammar.
 */
export const caretInCode = (source: string, caret: number): boolean => {
  let index = 0;
  while (index < source.length) {
    const parsed = parseAt(source, index);
    if (parsed === null) {
      index += 1;
      continue;
    }
    if (parsed.run.code && caret > index && caret < parsed.next) {
      return true;
    }
    index = parsed.next;
  }
  return false;
};
