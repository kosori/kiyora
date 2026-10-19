import { parseRuns, type Run, sanitizeHref } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const plain = (text: string): Run => ({
  bold: false,
  code: false,
  href: null,
  italic: false,
  text,
});

describe('parsing a label into runs', () => {
  it('reads plain words as one run', () => {
    expect(parseRuns('hello world')).toEqual([plain('hello world')]);
  });

  it('marks a bold span', () => {
    expect(parseRuns('say **now**')).toEqual([
      plain('say '),
      { ...plain('now'), bold: true },
    ]);
  });

  it('marks an italic span', () => {
    expect(parseRuns('a *soft* word')).toEqual([
      plain('a '),
      { ...plain('soft'), italic: true },
      plain(' word'),
    ]);
  });

  it('marks an inline code span', () => {
    expect(parseRuns('use `bun run test` here')).toEqual([
      plain('use '),
      { ...plain('bun run test'), code: true },
      plain(' here'),
    ]);
  });

  it('marks bold and italic together', () => {
    expect(parseRuns('***loud***')).toEqual([
      { ...plain('loud'), bold: true, italic: true },
    ]);
  });

  it('carries a link target on its run', () => {
    expect(parseRuns('see [the docs](https://example.com/a)')).toEqual([
      plain('see '),
      { ...plain('the docs'), href: 'https://example.com/a' },
    ]);
  });

  it('leaves markdown inside code alone, because code is literal', () => {
    expect(parseRuns('`**not bold**`')).toEqual([
      { ...plain('**not bold**'), code: true },
    ]);
  });

  it('leaves an unmatched marker as the text the author typed', () => {
    expect(parseRuns('2 * 3 = 6')).toEqual([plain('2 * 3 = 6')]);
    expect(parseRuns('an _underscore')).toEqual([plain('an _underscore')]);
  });

  it('does not italicise the underscores inside a word', () => {
    expect(parseRuns('snake_case_name')).toEqual([plain('snake_case_name')]);
  });

  it('splits a run around a hard line break', () => {
    expect(parseRuns('one\ntwo')).toEqual([plain('one\ntwo')]);
  });
});

describe('sanitising a link target', () => {
  it('keeps http, https and mailto', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeHref('http://example.com')).toBe('http://example.com');
    expect(sanitizeHref('mailto:me@example.com')).toBe('mailto:me@example.com');
  });

  it('refuses a script scheme, however it is cased or spaced', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeHref('JavaScript:alert(1)')).toBeNull();
    expect(sanitizeHref('  javascript:alert(1)')).toBeNull();
    expect(sanitizeHref('java\nscript:alert(1)')).toBeNull();
    expect(sanitizeHref('data:text/html,<script>')).toBeNull();
    expect(sanitizeHref('vbscript:msgbox(1)')).toBeNull();
  });

  it('refuses a target with no scheme, because a board is not a web page', () => {
    expect(sanitizeHref('/relative/path')).toBeNull();
    expect(sanitizeHref('example.com')).toBeNull();
    expect(sanitizeHref('')).toBeNull();
  });
});

describe('a hostile link in a label', () => {
  it('renders its words but never becomes a link', () => {
    const runs = parseRuns('[click me](javascript:alert(1))');

    expect(runs).toEqual([plain('click me')]);
    expect(runs.every((run) => run.href === null)).toBe(true);
  });
});
