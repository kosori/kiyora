import {
  type Board,
  type Measurer,
  type PaintContext,
  paintBoard,
  parseBoard,
  SCHEMA_VERSION,
  type Shape,
  type TableShape,
  tableCellBox,
  textOf,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const light: PaintContext = { theme: 'light' };

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run) => run.text.length * run.size * 0.5;

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const table = (overrides: Partial<TableShape> = {}): TableShape => ({
  columns: 2,
  h: 120,
  headerRow: true,
  id: 'table-1',
  kind: 'data-table',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  rows: [
    ['Name', 'Role'],
    ['Ada', 'Engineer'],
  ],
  style,
  w: 240,
  x: 0,
  y: 0,
  ...overrides,
});

const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Tables',
    updatedAt: 1_700_000_000_000,
  });

describe('painting a table', () => {
  it('divides its authored box evenly and marks the header row', () => {
    const paint = paintBoard(board([table()]), { ...light, measure: fake });
    const [node] = paint.children;

    expect(node?.paths).toContainEqual({
      d: 'M 0 0 L 240 0 L 240 60 L 0 60 Z',
      fill: 'rgba(30, 30, 30, 0.08)',
    });
    expect(node?.paths).toContainEqual({
      d: 'M 120 0 L 120 120',
      stroke: 'rgba(30, 30, 30, 0.25)',
      strokeWidth: 1,
    });
    expect(node?.paths).toContainEqual({
      d: 'M 0 60 L 240 60',
      stroke: 'rgba(30, 30, 30, 0.25)',
      strokeWidth: 1,
    });
  });

  it("wraps a cell's text exactly as a label in the same box", () => {
    const textStyle = { align: 'left', size: 16, valign: 'top' } as const;
    const words =
      'One two three four five six seven eight nine ten eleven twelve';
    const shape = table({
      columns: 1,
      h: 120,
      headerRow: false,
      rows: [[words]],
      textStyle,
      w: 200,
    });
    const painted = paintBoard(board([shape]), { ...light, measure: fake });
    const label: Shape = { ...shape, kind: 'text', text: words };

    expect(painted.children[0]?.text).toEqual(textOf(label, fake, '#1e1e1e'));
  });

  it('makes header cells bold so the first row reads as a heading', () => {
    const paint = paintBoard(board([table()]), { ...light, measure: fake });
    const header = paint.children[0]?.text?.[0];

    expect(header?.runs).toEqual([
      {
        bold: true,
        code: false,
        href: null,
        italic: false,
        text: 'Name',
      },
    ]);
  });

  it('paints a very long word without throwing, keeping it on its own line', () => {
    const word = 'Supercalifragilisticexpialidocious'.repeat(3);
    const painted = paintBoard(
      board([
        table({
          columns: 1,
          headerRow: false,
          rows: [[word]],
          w: 60,
        }),
      ]),
      { ...light, measure: fake }
    );

    expect(painted.children[0]?.text?.[0]?.runs[0]?.text).toBe(word);
  });

  it('paints only its authored box when the grid is empty', () => {
    const painted = paintBoard(board([table({ columns: 3, rows: [] })]), light);
    const [node] = painted.children;

    expect(node?.paths).toEqual([
      {
        d: 'M 0 0 L 240 0 L 240 120 L 0 120 Z',
        fill: 'rgba(25, 113, 194, 0.2)',
        stroke: '#1e1e1e',
        strokeWidth: 2,
      },
    ]);
    expect(node?.text).toBeUndefined();
  });

  it('scales every cell with the authored box, so a resize carries the grid', () => {
    const resized = table({ h: 200, w: 400 });

    expect(tableCellBox(resized, 1, 1)).toEqual({
      h: 100,
      w: 200,
      x: 200,
      y: 100,
    });
  });
});
