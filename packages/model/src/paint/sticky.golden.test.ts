import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Board,
  DEFAULT_TEXT_STYLE,
  fitSticky,
  type Measurer,
  NOTE_STYLE,
  type PaintContext,
  paintBoard,
  parseBoard,
  projectBoard,
  type StickyShape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run) => run.text.length * run.size * 0.5;

const golden = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./goldens/${name}`, import.meta.url)),
    'utf8'
  );

const sticky = (overrides: Partial<StickyShape> = {}): StickyShape => ({
  h: 160,
  id: 'sticky-1',
  kind: 'sticky',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: NOTE_STYLE,
  text: '',
  textStyle: DEFAULT_TEXT_STYLE,
  w: 160,
  x: 0,
  y: 0,
  ...overrides,
});

const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: 1,
    settings: { theme: 'light' },
    shapes,
    title: 'Notes',
    updatedAt: 1_700_000_000_000,
  });

describe('painting a sticky', () => {
  it('fills its note box and strokes it, so a sticky cannot ship invisible', () => {
    const paint = paintBoard(board([sticky()]), light);

    expect(paint.children[0]?.paths[0]).toEqual({
      d: 'M 0 0 L 160 0 L 160 160 L 0 160 Z',
      fill: '#f2c037',
      stroke: '#1e1e1e',
      strokeWidth: 2,
    });
  });

  it('paints its label in the foreground ink, centred in the note', () => {
    const paint = paintBoard(
      board([sticky({ h: 200, text: 'note', w: 160 })]),
      { ...light, measure: fake }
    );
    const line = paint.children[0]?.text?.[0];

    expect(line?.align).toBe('center');
    expect(line?.fill).toBe('#1e1e1e');
    expect(line?.x).toBe(80);
  });

  it('matches the committed golden for a labelled note, and paints a fill that is not none', () => {
    const note = sticky({
      h: 160,
      text: 'Remember to ship the note before the demo',
      w: 160,
    });
    const svg = projectBoard(board([note]), { ...light, measure: fake });

    expect(svg).toBe(golden('sticky.svg'));
    expect(svg).toContain('fill="#f2c037"');
    expect(svg).not.toContain('fill="none"');
  });
});

describe('growing a sticky', () => {
  it('grows the box downward to fit a long label, keeping its width and corner', () => {
    const note = sticky({ h: 160, text: '' });
    const grown = fitSticky(
      {
        ...note,
        text: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two',
      },
      fake
    );

    expect(grown.h).toBeGreaterThan(160);
    expect(grown.w).toBe(160);
    expect(grown.x).toBe(0);
    expect(grown.y).toBe(0);
  });

  it('leaves a note with room for its label exactly as it was authored', () => {
    const note = sticky({ h: 160, text: 'hi' });

    expect(fitSticky(note, fake)).toBe(note);
  });

  it('leaves a note with no label alone, so an empty sticky keeps its authored size', () => {
    const note = sticky({ h: 160, text: '' });

    expect(fitSticky(note, fake)).toBe(note);
  });
});
