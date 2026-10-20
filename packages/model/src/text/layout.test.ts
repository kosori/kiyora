import {
  type FigureShape,
  type MeasureRun,
  type Measurer,
  type PaintText,
  paintShape,
  type Shape,
  TEXT_SIZE_PRESETS,
  TEXT_SIZES,
  type TextShape,
  type TextStyle,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run: MeasureRun): number =>
  run.text.length * run.size * 0.5;

const textStyle = (overrides: Partial<TextStyle> = {}): TextStyle => ({
  align: 'center',
  size: TEXT_SIZE_PRESETS.medium,
  valign: 'middle',
  ...overrides,
});

type Base = Omit<FigureShape, 'kind'>;

const base = (overrides: Partial<Base> = {}): Base => ({
  h: 100,
  id: 'shape-1',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'blue',
    fillStyle: 'pastel',
    stroke: 'ink',
    strokeWidth: 2,
  },
  w: 200,
  x: 0,
  y: 0,
  ...overrides,
});

const figure = (overrides: Partial<Base> = {}): FigureShape => ({
  ...base(overrides),
  kind: 'rectangle',
});

const textShape = (overrides: Partial<Base> = {}): TextShape => ({
  ...base(overrides),
  kind: 'text',
});

const label = (shape: Shape): PaintText[] =>
  paintShape(shape, { measure: fake, theme: 'light' }).text ?? [];

describe('placing a label inside its shape', () => {
  it('paints the words in the foreground ink, never a fill that hides them', () => {
    const lines = label(figure({ text: 'hello' }));

    expect(lines).toHaveLength(1);
    expect(lines[0]?.fill).toBe('#1e1e1e');
    expect(lines[0]?.fill).not.toBe('none');
    expect(lines[0]?.runs.map((run) => run.text)).toEqual(['hello']);
  });

  it('sizes a line by the stored size, over the four presets', () => {
    const sizes = TEXT_SIZES.map((size) => {
      const lines = label(
        figure({ text: 'x', textStyle: textStyle({ size }) })
      );
      return lines[0]?.size;
    });

    expect(sizes).toEqual([...TEXT_SIZES]);
    expect(new Set(sizes).size).toBe(4);
  });

  it('anchors a line left, centre or right inside the shape', () => {
    const x = (align: 'left' | 'center' | 'right') =>
      label(figure({ text: 'x', textStyle: textStyle({ align }) }))[0]?.x;

    expect(x('left')).toBe(8);
    expect(x('center')).toBe(100);
    expect(x('right')).toBe(192);
  });

  it('places a shape label top, middle or bottom', () => {
    const y = (valign: 'top' | 'middle' | 'bottom') =>
      label(figure({ text: 'x', textStyle: textStyle({ valign }) }))[0]?.y;

    expect(y('top')).toBeCloseTo(20.8, 3);
    expect(y('middle')).toBeCloseTo(52.4, 3);
    expect(y('bottom')).toBeCloseTo(84, 3);
  });

  it('wraps a long label inside the shape rather than overflowing it', () => {
    const lines = label(
      figure({ text: 'aaaa bbbb cccc dddd eeee ffff gggg hhhh' })
    );

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.x).toBe(100);
    }
  });

  it('turns a label with its shape', () => {
    expect(label(figure({ rotation: 30, text: 'x' }))[0]?.transform).toBe(
      'rotate(30 100 50)'
    );
  });

  it('top-aligns a text shape whatever vertical alignment it carries, because a heading has no box to sit inside', () => {
    const y = (valign: 'top' | 'middle' | 'bottom') =>
      label(textShape({ text: 'x', textStyle: textStyle({ valign }) }))[0]?.y;

    expect(y('top')).toBeCloseTo(20.8, 3);
    expect(y('middle')).toBeCloseTo(20.8, 3);
    expect(y('bottom')).toBeCloseTo(20.8, 3);
  });

  it('draws a text shape with a label and no paths of its own', () => {
    const paint = paintShape(textShape({ text: 'heading' }), {
      measure: fake,
      theme: 'light',
    });

    expect(paint.paths).toEqual([]);
    expect(paint.text).toHaveLength(1);
  });

  it('carries no label when the shape has no text', () => {
    expect(label(figure())).toEqual([]);
    expect(
      paintShape(figure(), { measure: fake, theme: 'light' }).text
    ).toBeUndefined();
  });

  it('fails loudly rather than painting nothing when a label has no measurer', () => {
    expect(() =>
      paintShape(figure({ text: 'hello' }), { theme: 'light' })
    ).toThrow(/measurer/);
  });
});
