import {
  type Board,
  type FrameShape,
  mapSource,
  parseBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const frame = (overrides: Record<string, unknown> = {}): FrameShape => {
  const [parsed] = parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [
      {
        clip: true,
        h: 300,
        id: 'frame-1',
        kind: 'frame',
        locked: false,
        opacity: 1,
        parentId: null,
        rotation: 0,
        style,
        variant: 'plain',
        w: 400,
        x: 100,
        y: 100,
        ...overrides,
      },
    ],
    title: 'Source',
    updatedAt: 1_700_000_000_000,
  }).shapes;

  if (parsed?.kind !== 'frame') {
    throw new Error('the fixture is not a frame');
  }

  return parsed;
};

const board = (shapes: unknown[] = []): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [frame(), ...shapes],
    title: 'Source',
    updatedAt: 1_700_000_000_000,
  });

describe('mapping a source onto a frame', () => {
  it('turns one node into one figure inside the frame', () => {
    const result = mapSource('Box', frame(), style, board().shapes);

    expect(result.shapes).toHaveLength(1);
    const [figure] = result.shapes;

    expect(figure?.kind).toBe('rectangle');
    expect(figure?.parentId).toBe('frame-1');
    expect(figure?.text).toBe('Box');
    expect(figure?.x).toBeGreaterThan(100);
    expect(figure?.y).toBeGreaterThan(100);
    expect(figure?.x).toBeLessThan(500);
    expect(figure?.y).toBeLessThan(400);
  });

  it('keeps the figure kind the source names', () => {
    const result = mapSource('Box [ellipse]', frame(), style, board().shapes);

    expect(result.shapes[0]?.kind).toBe('ellipse');
  });

  it('turns every node into a figure, laid out along the direction', () => {
    const result = mapSource(
      'direction right\nA -> B\nA -> C',
      frame({ h: 600, w: 800 }),
      style,
      board().shapes
    );
    const [a, b, c] = result.shapes;

    expect(result.shapes.map((shape) => shape.text)).toEqual(['A', 'B', 'C']);
    expect(new Set(result.shapes.map((shape) => shape.id)).size).toBe(3);
    expect(b?.x).toBeGreaterThan(a?.x ?? 0);
    expect(c?.x).toBe(b?.x);
    expect(c?.y).toBeGreaterThan(b?.y ?? 0);
  });

  it('maps the same source to the same figures twice in one run', () => {
    const source = 'direction down\nA -> B\nA -> C';

    expect(mapSource(source, frame(), style, board().shapes).shapes).toEqual(
      mapSource(source, frame(), style, board().shapes).shapes
    );
  });

  it('gives the figure an id the board does not already hold', () => {
    const existing = board([
      {
        h: 100,
        id: 'rectangle-1',
        kind: 'rectangle',
        locked: false,
        opacity: 1,
        parentId: null,
        rotation: 0,
        style,
        w: 160,
        x: 0,
        y: 0,
      },
    ]);
    const result = mapSource('Box', frame(), style, existing.shapes);

    expect(result.shapes[0]?.id).toBe('rectangle-2');
  });

  it('maps an empty source to no shapes rather than an invalid one', () => {
    const result = mapSource('', frame(), style, board().shapes);

    expect(result.shapes).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('maps a source the parser cannot read to no shapes and its diagnostics', () => {
    const result = mapSource('->', frame(), style, board().shapes);

    expect(result.shapes).toEqual([]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
