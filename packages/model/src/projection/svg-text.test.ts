import {
  type Board,
  type MeasureRun,
  type Measurer,
  paintBoard,
  parseBoard,
  projectBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const fake: Measurer = (run: MeasureRun): number =>
  run.text.length * run.size * 0.5;

const light = { measure: fake, theme: 'light' as const };

const board = (shape: Record<string, unknown>): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [
      {
        h: 100,
        id: 'shape-1',
        kind: 'text',
        locked: false,
        opacity: 1,
        parentId: null,
        rotation: 0,
        style: {
          fill: 'blue',
          fillStyle: 'pastel',
          stroke: 'ink',
          strokeWidth: 2,
        },
        w: 200,
        x: 0,
        y: 0,
        ...shape,
      },
    ],
    title: 'Board',
    updatedAt: 1_700_000_000_000,
  });

const spans = (svg: string): string[] =>
  [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(
    (match) => match[1] ?? ''
  );

describe('projecting a label to SVG', () => {
  it('draws the words in a text element with a fill that is not none', () => {
    const svg = projectBoard(board({ text: 'hello' }), light);

    expect(svg).toContain('<text');
    expect(svg).toMatch(/<text[^>]*fill="#1e1e1e"/);
    expect(svg).not.toMatch(/<text[^>]*fill="none"/);
    expect(spans(svg)).toEqual(['hello']);
  });

  it('sets an inline code run in the monospace face', () => {
    const svg = projectBoard(board({ text: 'use `bun`' }), light);

    expect(svg).toContain(
      'font-family="\'Geist Mono\', ui-monospace, monospace"'
    );
  });

  it('draws a link as a real anchor, and walks the hostile ones away', () => {
    const safe = projectBoard(
      board({ text: '[docs](https://example.com/x?a=1&b=2)' }),
      light
    );
    expect(safe).toContain(
      '<a href="https://example.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">'
    );

    const hostile = projectBoard(
      board({ text: '[x](javascript:alert(1))' }),
      light
    );
    expect(hostile).not.toContain('javascript:');
    expect(hostile).not.toContain('<a ');
  });

  it('escapes the text of a label, so a label cannot inject markup', () => {
    const svg = projectBoard(board({ text: 'a < b & c' }), light);

    expect(svg).toContain('>a &lt; b &amp; c<');
    expect(svg).not.toContain('a < b & c');
  });

  it('wraps the same way in the artifact as on the canvas, because both measure through the same one', () => {
    const drawn = board({
      text: 'aaaa bbbb cccc dddd eeee ffff gggg hhhh',
    });
    const painted = paintBoard(drawn, light).children[0]?.text ?? [];
    const svg = projectBoard(drawn, light);

    expect(painted.length).toBeGreaterThan(1);
    expect(svg.match(/<text /g)).toHaveLength(painted.length);
    expect(spans(svg)).toEqual(
      painted.flatMap((line) => line.runs.map((run) => run.text))
    );
  });
});
