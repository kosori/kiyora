import {
  type MeasureRun,
  type Measurer,
  parseRuns,
  type Run,
  wrapRuns,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run: MeasureRun): number =>
  run.text.length * run.size * 0.5;

const run = (text: string, style: Partial<Run> = {}): Run => ({
  bold: false,
  code: false,
  href: null,
  italic: false,
  text,
  ...style,
});

const lines = (source: string, maxWidth: number, size = 10): Run[][] =>
  wrapRuns(parseRuns(source), maxWidth, size, fake).map((line) => line.runs);

describe('wrapping a label inside its box', () => {
  it('keeps a short label on one line', () => {
    expect(lines('one two', 100)).toEqual([[run('one two')]]);
  });

  it('breaks a long label at the spaces that fit', () => {
    expect(lines('one two three', 30)).toEqual([
      [run('one')],
      [run('two')],
      [run('three')],
    ]);
  });

  it('measures each character at its own size, so a bigger label wraps sooner', () => {
    expect(lines('aaaa bbbb', 40, 10)).toEqual([[run('aaaa')], [run('bbbb')]]);
    expect(lines('aaaa bbbb', 40, 8)).toEqual([[run('aaaa bbbb')]]);
  });

  it('keeps a word too long for the box on a line of its own rather than cutting it', () => {
    expect(lines('wide averylongword end', 40)).toEqual([
      [run('wide')],
      [run('averylongword')],
      [run('end')],
    ]);
  });

  it('breaks on a hard newline even when the line would fit', () => {
    expect(lines('one\ntwo', 100)).toEqual([[run('one')], [run('two')]]);
  });

  it('keeps the styling of a run when it is split across lines', () => {
    const wrapped = wrapRuns([run('alpha beta', { bold: true })], 30, 10, fake);

    expect(wrapped.map((line) => line.runs)).toEqual([
      [run('alpha', { bold: true })],
      [run('beta', { bold: true })],
    ]);
  });

  it('reports the width each line measured, so alignment and the box share one reading', () => {
    const wrapped = wrapRuns(parseRuns('one two three'), 30, 10, fake);

    expect(wrapped.map((line) => line.width)).toEqual([15, 15, 25]);
  });

  it('has nothing to lay out for empty text', () => {
    expect(wrapRuns(parseRuns(''), 100, 10, fake)).toEqual([]);
  });
});
