import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Board,
  type PaintContext,
  parseBoard,
  projectBoard,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

const golden = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./goldens/${name}`, import.meta.url)),
    'utf8'
  );

const filled = (svg: string): [string, string][] =>
  [...svg.matchAll(/fill="([^"]*)" stroke="([^"]*)"/g)].map((match) => [
    match[1] ?? '',
    match[2] ?? '',
  ]);

const camera = { x: 0, y: 0, zoom: 1 };

const timestamps = {
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const rectangle = () => ({
  h: 80,
  id: 'shape-1',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: { fill: 'blue', fillStyle: 'pastel', stroke: 'ink', strokeWidth: 2 },
  w: 120,
  x: 0,
  y: 0,
});

const rectangleBoard = (): Board =>
  parseBoard({
    ...timestamps,
    camera,
    deck: [],
    id: 'board-rectangle',
    schemaVersion: 1,
    settings: { theme: 'light' },
    shapes: [rectangle()],
    title: 'One rectangle',
  });

const board = (): Board =>
  parseBoard({
    ...timestamps,
    camera,
    deck: [],
    id: 'board-three',
    schemaVersion: 1,
    settings: { theme: 'light' },
    shapes: [
      {
        ...rectangle(),
        h: 60,
        id: 'filled',
        style: {
          fill: 'green',
          fillStyle: 'bold',
          stroke: 'green',
          strokeWidth: 2,
        },
        w: 100,
      },
      {
        ...rectangle(),
        h: 80,
        id: 'outlined',
        style: {
          fill: 'red',
          fillStyle: 'outline',
          stroke: 'red',
          strokeWidth: 1,
        },
        w: 80,
        x: 140,
        y: 20,
      },
      {
        ...rectangle(),
        h: 40,
        id: 'faded',
        opacity: 0.5,
        style: {
          fill: 'violet',
          fillStyle: 'bold',
          stroke: 'violet',
          strokeWidth: 4,
        },
        w: 60,
        x: 40,
        y: 100,
      },
    ],
    title: 'Three rectangles',
  });

describe('projecting a board to SVG', () => {
  it('matches the committed golden for one tinted rectangle, and paints its fill and stroke', () => {
    const svg = projectBoard(rectangleBoard(), light);

    expect(svg).toBe(golden('rectangle.svg'));
    expect(filled(svg)).toEqual([['rgba(25, 113, 194, 0.2)', '#1e1e1e']]);
  });

  it('matches the committed golden for a board, and paints every fill and stroke in order', () => {
    const svg = projectBoard(board(), light);

    expect(svg).toBe(golden('board.svg'));
    expect(filled(svg)).toEqual([
      ['#2f9e44', '#2f9e44'],
      ['none', '#e03131'],
      ['rgba(103, 65, 217, 0.5)', 'rgba(103, 65, 217, 0.5)'],
    ]);
  });

  it('projects the same board to byte-identical output, whatever order its keys arrive in', () => {
    const seen = projectBoard(rectangleBoard(), light);

    expect(projectBoard(rectangleBoard(), light)).toBe(seen);
    expect(
      projectBoard(
        parseBoard(JSON.parse(JSON.stringify(rectangleBoard()))),
        light
      )
    ).toBe(seen);
    expect(
      projectBoard(
        parseBoard(
          Object.fromEntries(Object.entries(rectangleBoard()).reverse())
        ),
        light
      )
    ).toBe(seen);
  });

  it('keeps display state out of the artifact: the camera is not an input', () => {
    const painted = projectBoard(board(), light);
    const moved = parseBoard({
      ...board(),
      camera: { x: -420, y: 180, zoom: 2.5 },
    });

    expect(projectBoard(moved, light)).toBe(painted);
  });

  it('paints the artifact on the canvas the context names', () => {
    const tint = rectangleBoard();

    expect(filled(projectBoard(tint, { theme: 'dark' }))).toEqual([
      ['rgba(116, 192, 252, 0.2)', '#e9ecef'],
    ]);
  });

  it('projects an empty board to an empty artifact', () => {
    expect(projectBoard(parseBoard({ ...board(), shapes: [] }), light)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0">\n</svg>\n'
    );
  });
});
