import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Board,
  exportBoardSvg,
  type Measurer,
  type PaintContext,
  parseBoard,
  SCHEMA_VERSION,
  SvgExportRefusal,
  unsafeSvg,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const fake: Measurer = (run) => run.text.length * run.size * 0.5;

const light: PaintContext = { measure: fake, theme: 'light' };

const style = (fill: string) => ({
  corner: 'sharp' as const,
  dash: 'solid' as const,
  fill,
  fillStyle: 'pastel' as const,
  stroke: 'ink',
  strokeWidth: 2,
});

const box = (id: string, x: number, fill: string) => ({
  h: 100,
  id,
  kind: 'rectangle' as const,
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: style(fill),
  w: 180,
  x,
  y: 0,
});

/** A representative board: a hand-drawn box with a label, a second box, and a connector between them. */
const representative = (): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-export',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [
      { ...box('card', 0, 'blue'), text: 'Export' },
      box('note', 280, 'green'),
      {
        end: 'arrow',
        from: { kind: 'bound', shapeId: 'card' },
        h: 40,
        id: 'writes',
        kind: 'connector',
        locked: false,
        opacity: 1,
        parentId: null,
        rotation: 0,
        route: 'straight',
        start: 'none',
        style: { ...style('gray'), strokeWidth: 2 },
        text: 'writes',
        to: { kind: 'bound', shapeId: 'note' },
        w: 200,
        x: 180,
        y: 0,
      },
    ],
    title: 'Export',
    updatedAt: 1_700_000_000_000,
  });

const golden = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./goldens/${name}`, import.meta.url)),
    'utf8'
  );

const paths = (svg: string): string[] =>
  [...svg.matchAll(/<path ([^>]*)\/>/g)].map((match) => match[1] ?? '');

describe('taking the board out as SVG', () => {
  it('matches the committed golden for a representative board, so the export contract is one file that can be read and diffed', () => {
    expect(exportBoardSvg(representative(), light)).toBe(golden('board.svg'));
  });

  it('paints the clean geometry, the connector and the label, each exactly once', () => {
    const svg = exportBoardSvg(representative(), light);
    const card = paths(svg).find((path) => path.includes('M 0 0 L 180 0'));
    const label = /<text [^>]*fill="([^"]*)"[^>]*>(.*?)<\/text>/s.exec(svg);

    expect(paths(svg)).toHaveLength(4);
    expect(card).toContain('fill="rgba(25, 113, 194, 0.2)" stroke="#1e1e1e"');
    expect(svg).toContain('fill="none" stroke="#1e1e1e" stroke-width="2"');
    expect(label?.[1]).not.toBe('none');
    expect(svg).toContain('>Export<');
    expect(svg).toContain('>writes<');
  });

  it('is the drawing, not a screenshot of the editor: no grid, no selection, no handles', () => {
    const svg = exportBoardSvg(representative(), light);

    expect(svg).not.toContain('data-testid');
    expect(svg).not.toContain('<pattern');
    expect(svg).not.toContain('kiyora-dot-grid');
    expect(svg).not.toContain('handle-');
  });

  it('leaves the SVG namespace as the only reference outside the file', () => {
    const svg = exportBoardSvg(representative(), light);

    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/
    );
    expect([...svg.matchAll(/https?:\/\/[^"')\s]+/g)].map((m) => m[0])).toEqual(
      ['http://www.w3.org/2000/svg']
    );
  });

  it('carries no script and no active content', () => {
    const svg = exportBoardSvg(representative(), light);

    expect(svg).not.toContain('<script');
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
    expect(svg).not.toContain('<foreignObject');
    expect(svg).not.toContain('<style');
  });

  it('refuses a document that would carry a script, an event handler or a reference outside the file', () => {
    expect(
      unsafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
    ).toMatch(/script/);
    expect(
      unsafeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><path onload="alert(1)"/></svg>'
      )
    ).toMatch(/handler/);
    expect(
      unsafeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://x.test/a.png"/></svg>'
      )
    ).toMatch(/image/);
    expect(
      unsafeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://x.test/a.svg)"/></svg>'
      )
    ).toMatch(/reference/);
    expect(unsafeSvg('<html><body/></html>')).toMatch(/SVG/);
    expect(unsafeSvg(exportBoardSvg(representative(), light))).toBeNull();
  });

  it('keeps a user-authored link, the one reference a label is allowed to carry', () => {
    const linked = parseBoard({
      ...representative(),
      shapes: [
        { ...box('card', 0, 'blue'), text: '[site](https://example.test)' },
      ],
    });
    const svg = exportBoardSvg(linked, light);

    expect(svg).toContain('href="https://example.test"');
    expect(unsafeSvg(svg)).toBeNull();
  });

  it('keeps a frame’s clip inside the file, so a clipped board still exports', () => {
    const framed = parseBoard({
      ...representative(),
      shapes: [
        {
          ...box('frame-1', 0, 'blue'),
          clip: true,
          h: 200,
          kind: 'frame',
          variant: 'plain',
          w: 300,
        },
        {
          ...box('member-1', 20, 'green'),
          h: 60,
          parentId: 'frame-1',
          w: 100,
          y: 20,
        },
      ],
    });

    expect(exportBoardSvg(framed, light)).toContain('url(#clip-frame-1)');
  });

  it('refuses a document over the size cap instead of writing a truncated file', () => {
    const svg = exportBoardSvg(representative(), light);
    const bytes = new TextEncoder().encode(svg).length;

    expect(exportBoardSvg(representative(), light, { limitBytes: bytes })).toBe(
      svg
    );
    expect(() =>
      exportBoardSvg(representative(), light, { limitBytes: bytes - 1 })
    ).toThrow(SvgExportRefusal);
    expect(() =>
      exportBoardSvg(representative(), light, { limitBytes: bytes - 1 })
    ).toThrow(/cap/);
  });
});
