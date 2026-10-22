import { createEditor } from '@kiyora/editor';
import {
  type Board,
  CHART_SERIES,
  type ChartShape,
  parseBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

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
  series: [4, 8, 6, 10],
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

const board = (shapes: unknown[] = [chart()]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Charts',
    updatedAt: 1_700_000_000_000,
  });

const onlyChart = (editor: ReturnType<typeof createEditor>): ChartShape => {
  const [shape] = editor.getBoard().shapes;
  if (shape?.kind !== 'chart') {
    throw new Error('the board holds no chart');
  }
  return shape;
};

describe('editing a chart', () => {
  it('replaces the series as one gesture, so one undo returns the old numbers', () => {
    const editor = createEditor(board());

    editor.setChart('chart-1', { series: [1, 9, 2] });

    expect(onlyChart(editor).series).toEqual([1, 9, 2]);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: true });

    editor.undo();

    expect(onlyChart(editor).series).toEqual([4, 8, 6, 10]);
    expect(editor.getHistory()).toEqual({ canRedo: true, canUndo: false });
  });

  it('keeps each replacement as its own history entry', () => {
    const editor = createEditor(board());

    editor.setChart('chart-1', { series: [1, 2] });
    editor.setChart('chart-1', { series: [3, 4] });

    editor.undo();
    expect(onlyChart(editor).series).toEqual([1, 2]);

    editor.undo();
    expect(onlyChart(editor).series).toEqual([4, 8, 6, 10]);
  });

  it('changes the kind, labels and palette without losing the series', () => {
    const editor = createEditor(board());

    editor.setChart('chart-1', {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      palette: ['red', 'yellow'],
      variant: 'donut',
    });

    expect(onlyChart(editor)).toMatchObject({
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      palette: ['red', 'yellow'],
      series: [4, 8, 6, 10],
      variant: 'donut',
    });

    editor.undo();

    expect(onlyChart(editor)).toMatchObject({
      labels: ['Mon', 'Tue', 'Wed', 'Thu'],
      palette: ['blue', 'orange', 'green', 'violet'],
      variant: 'column',
    });
  });

  it('writes nothing for a no-op, a shape that is not a chart, or a series with no numbers', () => {
    const editor = createEditor(board());
    const before = editor.getBoard();

    editor.setChart('chart-1', {
      series: [...(before.shapes[0] as ChartShape).series],
    });
    editor.setChart('missing', { series: [1, 2] });
    editor.setChart('chart-1', { series: [Number.NaN] });

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual({ canRedo: false, canUndo: false });
  });

  it('places a chart with its starting series, and one undo takes it back', () => {
    const editor = createEditor(board([]));
    editor.setTool('chart');

    editor.placeShape({ from: { x: 100, y: 100 }, to: { x: 100, y: 100 } });

    expect(editor.getBoard().shapes.at(-1)).toMatchObject({
      h: 220,
      kind: 'chart',
      series: [...CHART_SERIES],
      variant: 'column',
      w: 320,
      x: -60,
      y: -10,
    });

    editor.undo();

    expect(editor.getBoard().shapes).toEqual([]);
  });
});
