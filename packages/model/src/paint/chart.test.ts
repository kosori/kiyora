import {
  type Board,
  CHART_KINDS,
  type ChartKind,
  type ChartShape,
  type Measurer,
  type Paint,
  type PaintContext,
  paintBoard,
  parseBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run) => run.text.length * run.size * 0.5;

const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-chart',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Charts',
    updatedAt: 1_700_000_000_000,
  });

const chart = (overrides: Partial<ChartShape> = {}): ChartShape => ({
  h: 220,
  id: 'chart-1',
  kind: 'chart',
  labels: ['Mon', 'Tue', 'Wed', 'Thu'],
  locked: false,
  opacity: 1,
  palette: ['blue', 'orange', 'green', 'violet'],
  parentId: null,
  rotation: 0,
  series: [4, -2, 6, 0],
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'blue',
    fillStyle: 'pastel',
    stroke: 'ink',
    strokeWidth: 2,
  },
  variant: 'column',
  w: 320,
  x: 0,
  y: 0,
  ...overrides,
});

const painted = (
  shape: ChartShape,
  context: PaintContext = { measure: fake, theme: 'light' }
): Paint => {
  const [node] = paintBoard(board([shape]), context).children;

  if (node === undefined) {
    throw new Error('the chart painted no node');
  }

  return node;
};

const textOf = (paint: Paint): string[] =>
  (paint.text ?? []).flatMap((line) => line.runs.map((run) => run.text));

const fills = (paint: Paint): string[] =>
  paint.paths.flatMap((path) =>
    path.fill === undefined || path.fill === 'none' ? [] : [path.fill]
  );

/** The y coordinates of a rectangular or polyline path, read from its own markup. */
const ys = (d: string): number[] =>
  (d.match(/-?\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .filter((_, index) => index % 2 === 1);

const finite = (paint: Paint): boolean =>
  paint.paths.every((path) => !/NaN|Infinity/.test(path.d));

describe('a chart with one point', () => {
  it.each(CHART_KINDS)(
    'paints %s as a visible mark rather than an empty line',
    (variant) => {
      const paint = painted(chart({ labels: ['Only'], series: [7], variant }));

      expect(paint.paths.length).toBeGreaterThan(0);
      expect(paint.paths.some((path) => path.d !== '')).toBe(true);
      expect(finite(paint)).toBe(true);
    }
  );
});

describe('a chart of zeros', () => {
  it.each(CHART_KINDS)(
    'paints %s legibly instead of dividing by a zero range',
    (variant) => {
      const paint = painted(
        chart({ labels: ['', '', '', ''], series: [0, 0, 0, 0], variant })
      );

      expect(finite(paint)).toBe(true);
      expect(paint.paths.length).toBeGreaterThan(0);

      if (variant === 'sparkline') {
        expect(paint.paths).toHaveLength(1);
        return;
      }

      if (variant === 'pie' || variant === 'donut') {
        expect(fills(paint)).toHaveLength(4);
        return;
      }

      expect(
        paint.paths.some(
          (path) =>
            (path.fill !== undefined && path.fill !== 'none') ||
            (path.stroke !== undefined && path.stroke !== 'none')
        )
      ).toBe(true);
    }
  );

  it('cuts a zero-value pie into equal wedges, not one full circle', () => {
    const pie = painted(
      chart({ labels: ['', '', '', ''], series: [0, 0, 0, 0], variant: 'pie' })
    );
    const wedges = pie.paths.filter((path) => path.fill !== 'none');

    expect(wedges).toHaveLength(4);
    expect(new Set(wedges.map((path) => path.d)).size).toBe(4);
  });

  it('gives a zero-value column a one-unit sliver on the baseline', () => {
    const column = painted(chart({ series: [0], variant: 'column' }));
    const [mark] = column.paths.filter((path) => path.fill !== 'none');

    expect(mark?.d).toBeDefined();
    expect(
      Math.max(...ys(mark?.d ?? '')) - Math.min(...ys(mark?.d ?? ''))
    ).toBe(1);
  });
});

describe('a chart with negative values', () => {
  it('draws a negative column below the baseline and a positive one above it', () => {
    const paint = painted(chart({ labels: ['Neg', 'Pos'], series: [-5, 5] }));
    const [negative, positive] = paint.paths.filter(
      (path) => path.fill !== 'none'
    );

    expect(Math.min(...ys(negative?.d ?? ''))).toBeGreaterThan(
      Math.min(...ys(positive?.d ?? ''))
    );
    expect(Math.max(...ys(negative?.d ?? ''))).toBeGreaterThan(
      Math.max(...ys(positive?.d ?? ''))
    );
  });

  it('keeps a negative-only series above the floor instead of flipping it', () => {
    const paint = painted(chart({ series: [-5, -2], variant: 'bar' }));

    expect(finite(paint)).toBe(true);
    expect(fills(paint)).toHaveLength(2);
  });
});

describe('a chart’s labels', () => {
  it('measures every category and tick through the injected measurer', () => {
    const calls: string[] = [];
    const measure: Measurer = (run) => {
      calls.push(run.text);
      return run.text.length * run.size * 0.5;
    };

    painted(chart({ variant: 'column' }), { measure, theme: 'light' });

    expect(calls).toContain('Mon');
    expect(calls).toContain('0');
    expect(textOf(painted(chart({ variant: 'column' })))).toContain('Mon');
  });

  it('truncates a category label that overflows its slot', () => {
    const paint = painted(
      chart({
        labels: Array.from({ length: 8 }, () => 'Wednesday'),
        series: Array.from({ length: 8 }, () => 1),
        w: 200,
      })
    );
    const texts = textOf(paint);

    expect(texts.some((text) => text === 'Wednesday')).toBe(false);
    expect(texts.some((text) => text.endsWith('…'))).toBe(true);
  });

  it('drops the category row when the series is longer than the box can label', () => {
    const paint = painted(
      chart({
        labels: Array.from({ length: 60 }, (_, index) => `Category ${index}`),
        series: Array.from({ length: 60 }, () => 1),
        w: 200,
      })
    );

    expect(textOf(paint).some((text) => text.includes('Category'))).toBe(false);
    expect(finite(paint)).toBe(true);
  });

  it('paints no labels without a measurer, and still paints the marks', () => {
    const paint = painted(chart(), { theme: 'light' });

    expect(paint.paths.length).toBeGreaterThan(0);
    expect(textOf(paint)).toEqual([]);
  });

  it('lays a pie’s legend out and truncates the labels it cannot fit', () => {
    const paint = painted(
      chart({
        labels: Array.from({ length: 4 }, () => 'A very long category'),
        series: [1, 2, 3, 4],
        variant: 'pie',
        w: 240,
      })
    );

    expect(textOf(paint).every((text) => text.length < 18)).toBe(true);
    expect(fills(paint)).toHaveLength(8);
  });
});

describe('a chart’s styling', () => {
  it('cycles the palette across the categories it draws', () => {
    const paint = painted(
      chart({
        palette: ['blue', 'orange'],
        series: [1, 2, 3],
        variant: 'column',
      })
    );

    expect(new Set(fills(paint)).size).toBe(2);
  });

  it('paints the dark canvas with the dark palette, not the light one', () => {
    const paint = painted(chart({ variant: 'column' }), {
      measure: fake,
      theme: 'dark',
    });

    expect(fills(paint)[0]).toContain('116, 192, 252');
  });

  it('turns every mark and every label with the shape', () => {
    const paint = painted(chart({ rotation: 30 }));

    expect(
      paint.paths.every((path) => path.transform?.startsWith('rotate(30 '))
    ).toBe(true);
    expect(
      (paint.text ?? []).every((line) =>
        line.transform?.startsWith('rotate(30 ')
      )
    ).toBe(true);
  });

  it('fades with the shape’s opacity', () => {
    const paint = painted(chart({ opacity: 0.5 }));

    expect(fills(paint).every((fill) => fill.endsWith('0.425)'))).toBe(true);
  });

  it('paints a sparkline with no axis, no gridlines and no labels', () => {
    const paint = painted(chart({ variant: 'sparkline' }));

    expect(paint.paths).toHaveLength(1);
    expect(textOf(paint)).toEqual([]);
  });
});

describe('a chart in a box with no room', () => {
  it('paints nothing rather than a negative rectangle', () => {
    expect(painted(chart({ h: 0, variant: 'column', w: 0 })).paths).toEqual([]);
  });
});

describe('a chart kind', () => {
  it('has exactly the eight kinds the product row names', () => {
    expect(CHART_KINDS).toEqual([
      'bar',
      'column',
      'line',
      'area',
      'pie',
      'donut',
      'scatter',
      'sparkline',
    ]);
  });

  it('is a variant, so the same series can become any of them', () => {
    const kinds: ChartKind[] = [...CHART_KINDS];

    for (const variant of kinds) {
      expect(painted(chart({ variant })).paths.length).toBeGreaterThan(0);
    }
  });
});
