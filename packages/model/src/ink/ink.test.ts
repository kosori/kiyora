import {
  addStrokePoint,
  type Board,
  type InkStrokePoint,
  inkAt,
  inkFromStroke,
  inkPath,
  inkWidths,
  MAX_INK_POINTS,
  parseBoard,
  SCHEMA_VERSION,
  type Style,
  shapeBounds,
  simplifyStroke,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style: Style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
};

const board = (shapes: Board['shapes']): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Ink',
    updatedAt: 1_700_000_000_000,
  });

describe('ink', () => {
  it('round-trips a stroke through the schema with its pressure intact', () => {
    const pen = inkFromStroke('ink-1', 'pen', style, [
      { pressure: 0.2, x: 10, y: 10 },
      { pressure: 0.9, x: 60, y: 40 },
      { pressure: 0.45, x: 120, y: 20 },
    ]);
    const highlighter = inkFromStroke('highlighter-1', 'highlighter', style, [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]);
    const before = board([pen, highlighter]);

    const after = parseBoard(JSON.parse(JSON.stringify(before)));

    expect(after).toEqual(before);
    const [storedPen, storedHighlighter] = after.shapes;
    expect(storedPen).toMatchObject({ kind: 'ink', mode: 'pen' });
    expect(
      storedPen?.kind === 'ink'
        ? storedPen.points.map((point) => point.pressure)
        : []
    ).toEqual([0.2, 0.9, 0.45]);
    expect(storedHighlighter).toMatchObject({ mode: 'highlighter' });
  });

  it('simplifies a dense stroke, keeping both endpoints and every stored pressure', () => {
    const raw: InkStrokePoint[] = Array.from({ length: 101 }, (_, index) => ({
      pressure: index / 100,
      x: index,
      y: index % 2 === 0 ? 0 : 4,
    }));

    const kept = simplifyStroke(raw, 5);

    expect(kept[0]).toBe(raw[0]);
    expect(kept.at(-1)).toBe(raw.at(-1));
    expect(kept.length).toBeLessThan(raw.length);
    expect(kept.every((point) => raw.includes(point))).toBe(true);
    expect(kept.some((point) => point.pressure !== undefined)).toBe(true);
  });

  it('caps a stroke at the stored point budget, endpoints included', () => {
    const raw = Array.from({ length: 4000 }, (_, index) => ({
      x: index,
      y: 0,
    }));

    const kept = simplifyStroke(raw, 0);

    expect(kept).toHaveLength(MAX_INK_POINTS);
    expect(kept[0]).toBe(raw[0]);
    expect(kept.at(-1)).toBe(raw.at(-1));
  });

  it('drops a sample too close to the last and keeps the growing endpoint', () => {
    const stroke = [{ x: 0, y: 0 }];
    const near = addStrokePoint(stroke, { x: 0.5, y: 0 }, 2);
    const far = addStrokePoint(stroke, { x: 3, y: 0 }, 2);

    expect(near).toEqual(stroke);
    expect(far).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('draws a mouse stroke at one width and a pen stroke tapering with its pressure', () => {
    const points: InkStrokePoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const mouse = inkFromStroke('ink-1', 'pen', style, points);
    const pen = inkFromStroke('ink-2', 'pen', style, [
      { pressure: 0.1, x: 0, y: 0 },
      { pressure: 0.5, x: 50, y: 0 },
      { pressure: 0.95, x: 100, y: 0 },
    ]);

    expect(mouse.points.every((point) => point.pressure === undefined)).toBe(
      true
    );
    expect(new Set(inkWidths(mouse)).size).toBe(1);
    expect(new Set(inkWidths(pen).map((width) => width.toFixed(6))).size).toBe(
      3
    );
    expect(inkPath(mouse)).not.toBe(inkPath(pen));
  });

  it('draws a one-sample stroke as a round dot rather than nothing', () => {
    const dot = inkFromStroke('ink-1', 'pen', style, [{ x: 10, y: 20 }]);

    expect(inkPath(dot)).toMatch(/^M 9 20 a /);
    expect(inkPath(dot)).toContain('Z');
  });

  it('hits the stroke near its line, not by the box around it', () => {
    const stroke = inkFromStroke('ink-1', 'pen', style, [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);

    expect(inkAt(stroke, { x: 50, y: 3 }, 4)).toBe(true);
    expect(inkAt(stroke, { x: 50, y: 40 }, 4)).toBe(false);
  });

  it('picks a turned stroke where it is painted', () => {
    const stroke = {
      ...inkFromStroke('ink-1', 'pen', style, [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
      rotation: 90,
    };
    const centre = { x: 50, y: 0 };

    expect(inkAt(stroke, { x: centre.x, y: centre.y + 40 }, 4)).toBe(true);
    expect(inkAt(stroke, { x: centre.x + 40, y: centre.y }, 4)).toBe(false);
  });

  it('holds the stroke width inside its painted box, so a selection frames the ink', () => {
    const stroke = inkFromStroke('ink-1', 'pen', style, [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
    ]);

    expect(shapeBounds(stroke, [stroke])).toEqual({
      h: 2,
      w: 102,
      x: 9,
      y: 9,
    });
  });
});
