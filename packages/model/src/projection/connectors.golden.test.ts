import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Board,
  type Measurer,
  paintBoard,
  parseBoard,
  projectBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const fake: Measurer = (run) => run.text.length * run.size * 0.5;

const light = { measure: fake, theme: 'light' as const };

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const rectangle = (id: string, x: number, y: number) => ({
  h: 80,
  id,
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 120,
  x,
  y,
});

const connector = () => ({
  end: 'arrow',
  from: { kind: 'bound', shapeId: 'left' },
  h: 40,
  id: 'connector-1',
  kind: 'connector',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  route: 'straight',
  start: 'none',
  style,
  text: 'flows',
  to: { kind: 'bound', shapeId: 'right' },
  w: 300,
  x: 0,
  y: 0,
});

const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-connectors',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Connectors',
    updatedAt: 1_700_000_000_000,
  });

const golden = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./goldens/${name}`, import.meta.url)),
    'utf8'
  );

const paths = (svg: string) =>
  [...svg.matchAll(/<path ([^>]*)\/>/g)].map((match) => match[1] ?? '');

describe('projecting connectors to SVG', () => {
  it('matches the committed golden for two joined shapes', () => {
    const svg = projectBoard(
      board([
        rectangle('left', 0, 0),
        rectangle('right', 300, 40),
        connector(),
      ]),
      light
    );

    expect(svg).toBe(golden('connectors.svg'));
  });

  it('paints the line as a real stroke and the arrowhead in the same ink', () => {
    const svg = projectBoard(
      board([
        rectangle('left', 0, 0),
        rectangle('right', 300, 40),
        connector(),
      ]),
      light
    );
    const inks = paths(svg).filter((path) => !/data-wobble/.test(path));

    expect(inks.some((path) => /stroke="#1e1e1e"/.test(path))).toBe(true);
    expect(inks.filter((path) => /fill="#1e1e1e"/.test(path))).toHaveLength(1);
  });

  it('draws the route with the same overlay the canvas gets, so the two agree', () => {
    const source = board([
      rectangle('left', 0, 0),
      rectangle('right', 300, 40),
      connector(),
    ]);
    const node = paintBoard(source, light).children.find(
      (child) => child.shapeId === 'connector-1'
    );
    const ribbon = node?.paths.find((path) => path.overlay)?.d;
    const svg = projectBoard(source, light);

    expect(ribbon).toBeDefined();
    expect(ribbon?.length).toBeGreaterThan(0);
    expect(svg).toContain(`data-wobble="true"`);
    expect(svg).toContain(`d="${ribbon}"`);
  });

  it('draws the label as visible text, never the invisible `none`', () => {
    const svg = projectBoard(
      board([
        rectangle('left', 0, 0),
        rectangle('right', 300, 40),
        connector(),
      ]),
      light
    );

    expect(svg).toMatch(/<text[^>]*fill="#1e1e1e"/);
    expect(svg).toContain('>flows<');
    expect(svg).not.toMatch(/<text[^>]*fill="none"/);
  });

  it('re-routes from the board when a bound shape moves, with no repair pass', () => {
    const before = projectBoard(
      board([
        rectangle('left', 0, 0),
        rectangle('right', 300, 40),
        connector(),
      ]),
      light
    );
    const moved = projectBoard(
      board([
        rectangle('left', 0, 200),
        rectangle('right', 300, 40),
        connector(),
      ]),
      light
    );

    expect(moved).not.toBe(before);
  });

  it('keeps a connector drawn before its target exists visible', () => {
    const orphan = {
      ...connector(),
      from: { kind: 'free', x: 10, y: 20 },
      h: 60,
      to: { kind: 'bound', shapeId: 'missing' },
      w: 300,
      x: 10,
      y: 20,
    };
    const [painted] = paintBoard(board([orphan]), light).children;

    expect(painted?.paths.length).toBeGreaterThan(0);
    expect(painted?.paths[0]?.d).toContain('M 10 20');
  });
});
