import { SHAPES } from '@kiyora/dsl';
import {
  type Board,
  boundsOfShapes,
  type ConnectorShape,
  type FrameShape,
  type Measurer,
  mapSource,
  type Paint,
  paintBoard,
  paintShape,
  parseBoard,
  resolveConnector,
  SCHEMA_VERSION,
  type Shape,
  shapeBounds,
  TEXT_PADDING,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run) => run.text.length * run.size * 0.5;

const firstShape = (shapes: readonly Shape[]): Shape => {
  const [shape] = shapes;
  if (shape === undefined) {
    throw new Error('the source produced no shapes');
  }

  return shape;
};

const connectorOf = (shapes: readonly Shape[]): ConnectorShape => {
  const connector = shapes.find((shape) => shape.kind === 'connector');
  if (connector?.kind !== 'connector') {
    throw new Error('the source produced no connector');
  }

  return connector;
};

const named = (shapes: readonly Shape[], text: string): Shape => {
  const shape = shapes.find((one) => one.text === text);
  if (shape === undefined) {
    throw new Error(`the source produced no shape named ${text}`);
  }

  return shape;
};

/** Every run of text a paint tree draws, in paint order. */
const paintedWords = (paint: Paint): string[] => [
  ...(paint.text ?? []).flatMap((line) => line.runs.map((run) => run.text)),
  ...paint.children.flatMap(paintedWords),
];

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

  it('maps every figure token the grammar names to the same shape on the board', () => {
    for (const token of SHAPES) {
      const [shape] = mapSource(
        `Box [${token}]`,
        frame(),
        style,
        board().shapes
      ).shapes;

      expect(shape?.kind).toBe(token);
    }
  });

  it('turns every node into a figure, laid out along the direction', () => {
    const result = mapSource(
      'direction right\nA -> B\nA -> C',
      frame({ h: 600, w: 800 }),
      style,
      board().shapes
    );
    const figures = result.shapes.filter((shape) => shape.kind !== 'connector');
    const [a, b, c] = figures;

    expect(figures.map((shape) => shape.text)).toEqual(['A', 'B', 'C']);
    expect(new Set(result.shapes.map((shape) => shape.id)).size).toBe(
      result.shapes.length
    );
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

  it('resolves a node colour through the palette, snapping a CSS name', () => {
    const [shape] = mapSource(
      'Box [crimson, bold, rounded]',
      frame(),
      style,
      board().shapes
    ).shapes;

    expect(shape?.style).toMatchObject({
      corner: 'rounded',
      fill: 'red',
      fillStyle: 'bold',
    });
  });

  it('resolves an edge colour and dash through the palette', () => {
    const connector = mapSource(
      'A --> B [teal]',
      frame(),
      style,
      board().shapes
    ).shapes.find((shape) => shape.kind === 'connector');

    expect(connector?.style).toMatchObject({ dash: 'dashed', stroke: 'teal' });
  });

  it('leaves an unreadable token at the default and keeps the diagnostic', () => {
    const result = mapSource('Box [wobble]', frame(), style, board().shapes);

    expect(result.shapes[0]?.kind).toBe('rectangle');
    expect(result.shapes[0]?.style).toEqual(style);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('carries a label whole and lets the measurer wrap it like a drawn one', () => {
    const label = 'alpha beta gamma delta epsilon zeta eta theta iota kappa';
    const shape = firstShape(
      mapSource(label, frame(), style, board().shapes).shapes
    );
    const lines = paintShape(shape, { measure: fake, theme: 'light' }).text;

    expect(shape.text).toBe(label);
    expect(lines?.length).toBeGreaterThan(1);
    for (const line of lines ?? []) {
      const width = line.runs.reduce(
        (sum, run) =>
          sum +
          fake({
            bold: run.bold,
            code: run.code,
            italic: run.italic,
            size: line.size,
            text: run.text,
          }),
        0
      );
      expect(width).toBeLessThanOrEqual(shape.w - TEXT_PADDING * 2 + 0.001);
    }
  });

  it('turns a source group into a Group whose members name it', () => {
    const { shapes } = mapSource(
      'group Web { A, B }\nWeb -> C',
      frame(),
      style,
      board().shapes
    );
    const group = shapes.find((shape) => shape.kind === 'group');
    if (group === undefined) {
      throw new Error('the source produced no group');
    }
    const members = shapes.filter((shape) => shape.parentId === group.id);

    expect(members.map((shape) => shape.text).sort()).toEqual(['A', 'B']);
    expect(group.parentId).toBe('frame-1');
    expect(shapeBounds(group, shapes)).toEqual(boundsOfShapes(members));
  });

  it('nests a source group inside the group that holds it', () => {
    const { shapes } = mapSource(
      'group Outer {\n  A\n  group Inner {\n    B\n  }\n}',
      frame(),
      style,
      board().shapes
    );
    const outer = shapes.find(
      (shape) => shape.kind === 'group' && shape.parentId === 'frame-1'
    );
    expect(outer).toBeDefined();
    const inner = shapes.find(
      (shape) => shape.kind === 'group' && shape.parentId === outer?.id
    );
    const b = shapes.find((shape) => shape.text === 'B');

    expect(inner).toBeDefined();
    expect(b?.parentId).toBe(inner?.id);
  });

  it('binds a connector to both nodes it joins', () => {
    const { shapes } = mapSource('A -> B', frame(), style, board().shapes);
    const a = named(shapes, 'A');
    const b = named(shapes, 'B');
    const connector = connectorOf(shapes);

    expect(connector.from).toEqual({ kind: 'bound', shapeId: a.id });
    expect(connector.to).toEqual({ kind: 'bound', shapeId: b.id });
    expect(connector).toMatchObject({
      end: 'arrow',
      parentId: 'frame-1',
      route: 'straight',
      start: 'none',
    });
  });

  it('re-routes a bound connector when its node moves', () => {
    const { shapes } = mapSource('A -> B', frame(), style, board().shapes);
    const a = named(shapes, 'A');
    const context = [frame(), ...shapes];
    const connector = connectorOf(shapes);
    const before = resolveConnector(connector, context);
    const moved = context.map((shape) =>
      shape.id === a.id ? { ...shape, y: shape.y + 200 } : shape
    );
    const after = resolveConnector(connector, moved);

    expect(after.from.shape?.id).toBe(a.id);
    expect(after.from.point).not.toEqual(before.from.point);
    expect(after.from.point.y).toBeGreaterThanOrEqual(a.y + 200);
  });

  it('takes its heads from the arrows, validating a named head', () => {
    const heads = (source: string) =>
      connectorOf(mapSource(source, frame(), style, board().shapes).shapes);

    expect(heads('A <- B')).toMatchObject({ end: 'none', start: 'arrow' });
    expect(heads('A <-> B')).toMatchObject({ end: 'arrow', start: 'arrow' });
    expect(heads('A -> B [head: circle]')).toMatchObject({
      end: 'circle',
      start: 'none',
    });
    expect(heads('A -> B [head: nonsense]')).toMatchObject({
      end: 'arrow',
      start: 'none',
    });
  });

  it('carries an edge label onto the connector', () => {
    const connector = connectorOf(
      mapSource('A -> B : flows', frame(), style, board().shapes).shapes
    );

    expect(connector.text).toBe('flows');
  });

  it('attaches an edge that names a group to that group', () => {
    const { shapes } = mapSource(
      'group Web { A, B }\nWeb -> C',
      frame(),
      style,
      board().shapes
    );
    const group = shapes.find((shape) => shape.kind === 'group');
    const connector = connectorOf(shapes);
    if (group === undefined) {
      throw new Error('the source produced no group');
    }
    expect(connector.from).toEqual({ kind: 'bound', shapeId: group.id });

    const context = [frame(), ...shapes];
    const before = resolveConnector(connector, context);
    const box = shapeBounds(group, context);
    expect(before.from.shape?.id).toBe(group.id);
    expect(before.from.point.x).toBeCloseTo(box.x + box.w, 3);

    const b = named(shapes, 'B');
    const moved = context.map((shape) =>
      shape.id === b.id ? { ...shape, x: shape.x + 100 } : shape
    );
    const after = resolveConnector(connector, moved);
    expect(shapeBounds(group, moved).w).toBeGreaterThan(box.w);
    expect(after.from.point).not.toEqual(before.from.point);
  });

  it('remaps every id so two frames with the same source share none', () => {
    const source = 'group Web { A, B }\nWeb -> C';
    const secondFrame = frame({ id: 'frame-2', x: 600 });
    const first = mapSource(
      source,
      frame(),
      style,
      board([secondFrame]).shapes
    );
    const existing = board([secondFrame, ...first.shapes]).shapes;
    const second = mapSource(source, secondFrame, style, existing);
    const firstIds = new Set(first.shapes.map((shape) => shape.id));
    const secondIds = new Set(second.shapes.map((shape) => shape.id));

    expect(second.shapes.some((shape) => firstIds.has(shape.id))).toBe(false);
    for (const shape of second.shapes) {
      expect(shape.id).not.toBe('frame-1');
      expect(shape.id).not.toBe('frame-2');
      if (shape.kind === 'connector') {
        if (shape.from.kind === 'bound') {
          expect(secondIds.has(shape.from.shapeId)).toBe(true);
        }
        if (shape.to.kind === 'bound') {
          expect(secondIds.has(shape.to.shapeId)).toBe(true);
        }
      }
      if (shape.parentId !== null && shape.parentId !== 'frame-2') {
        expect(secondIds.has(shape.parentId)).toBe(true);
      }
    }
  });

  it('produces a board that paints the generated labels and the connector', () => {
    const { shapes } = mapSource(
      'group Web { A, B }\nWeb -> C : flows',
      frame(),
      style,
      board().shapes
    );
    const built = board([...shapes]);
    const painted = paintBoard(built, { measure: fake, theme: 'light' });

    expect(paintedWords(painted)).toEqual(
      expect.arrayContaining(['A', 'B', 'C', 'flows'])
    );
  });
});
