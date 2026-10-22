import { createEditor } from '@kiyora/editor';
import {
  type Board,
  DEFAULT_TEXT_STYLE,
  emptyTableRows,
  parseBoard,
  SCHEMA_VERSION,
  type TableShape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const board = (shapes: Board['shapes'] = []): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Board',
    updatedAt: 1_700_000_000_000,
  });

const click = (x: number, y: number) => ({ from: { x, y }, to: { x, y } });

const table = (overrides: Partial<TableShape> = {}): TableShape => ({
  columns: 2,
  h: 120,
  headerRow: true,
  id: 'data-table-1',
  kind: 'data-table',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  rows: [
    ['Name', 'Role'],
    ['Ada', 'Engineer'],
  ],
  style: {
    corner: 'sharp',
    dash: 'solid',
    fill: 'blue',
    fillStyle: 'pastel',
    stroke: 'ink',
    strokeWidth: 2,
  },
  textStyle: DEFAULT_TEXT_STYLE,
  w: 240,
  x: 0,
  y: 0,
  ...overrides,
});

/** The one table on the editor's board, narrowed for its own fields. */
const onlyTable = (editor: ReturnType<typeof createEditor>): TableShape => {
  const [shape] = editor.getBoard().shapes;

  if (shape?.kind !== 'data-table') {
    throw new Error('expected a table');
  }
  return shape;
};

describe('a table on the board', () => {
  it('is placed with three rows and three columns of empty cells', () => {
    const editor = createEditor(board());
    editor.setTool('data-table');

    editor.placeShape(click(400, 300));

    expect(onlyTable(editor)).toMatchObject({
      columns: 3,
      h: 180,
      headerRow: true,
      kind: 'data-table',
      rows: emptyTableRows(3, 3),
      w: 360,
      x: 220,
      y: 210,
    });
  });

  it('lands a cell edit as one undo, the words coming and going together', () => {
    const editor = createEditor(board([table()]));

    editor.beginTextEdit();
    editor.setTableCell('data-table-1', { column: 0, row: 1 }, 'Grace');
    editor.endTextEdit();

    expect(onlyTable(editor).rows[1]?.[0]).toBe('Grace');

    editor.undo();

    expect(onlyTable(editor).rows[1]?.[0]).toBe('Ada');
    expect(editor.getHistory().canUndo).toBe(false);
  });

  it('adds a row or a column as one gesture each, and undo puts the grid back', () => {
    const editor = createEditor(board([table()]));

    editor.addTableRow('data-table-1');
    expect(onlyTable(editor).rows).toHaveLength(3);

    editor.addTableColumn('data-table-1');
    expect(onlyTable(editor).columns).toBe(3);
    expect(onlyTable(editor).rows.every((row) => row.length === 3)).toBe(true);

    editor.undo();
    expect(onlyTable(editor).columns).toBe(2);

    editor.undo();
    expect(onlyTable(editor).rows).toHaveLength(2);
    expect(editor.getHistory().canUndo).toBe(false);
  });
});
