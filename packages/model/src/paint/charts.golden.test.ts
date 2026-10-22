import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Board,
  CHART_KINDS,
  type ChartKind,
  type ChartShape,
  type Measurer,
  parseBoard,
  projectBoard,
  SCHEMA_VERSION,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

/**
 * A golden per chart kind: the whole painted document, so a change in the bars,
 * the gridlines, the label places or the legend has to be seen and accepted
 * rather than slipping past an element count. The fake measurer makes labels
 * byte-identical between the canvas and this file.
 */

const measure: Measurer = (run) => run.text.length * run.size * 0.55;

const golden = (name: string): string =>
  readFileSync(
    fileURLToPath(new URL(`./goldens/${name}`, import.meta.url)),
    'utf8'
  );

const chart = (variant: ChartKind): ChartShape => ({
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
  variant,
  w: 320,
  x: 0,
  y: 0,
});

const board = (variant: ChartKind): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-charts',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes: [chart(variant)],
    title: 'Charts',
    updatedAt: 1_700_000_000_000,
  });

describe('a chart kind paints the same golden paths', () => {
  it.each(CHART_KINDS)('%s', (variant) => {
    expect(projectBoard(board(variant), { measure, theme: 'light' })).toBe(
      golden(`chart-${variant}.svg`)
    );
  });

  it('paints the same bytes twice, so the golden is meaningful', () => {
    const once = projectBoard(board('column'), { measure, theme: 'light' });
    const twice = projectBoard(board('column'), { measure, theme: 'light' });

    expect(twice).toBe(once);
  });

  it('paints the same bytes after a board-file round trip', () => {
    const stored = JSON.parse(JSON.stringify(board('area'))) as unknown;

    expect(projectBoard(parseBoard(stored), { measure, theme: 'light' })).toBe(
      projectBoard(board('area'), { measure, theme: 'light' })
    );
  });
});
