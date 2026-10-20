import { createEditor } from '@kiyora/editor';
import { type Board, parseBoard, SCHEMA_VERSION } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const board = (shapes: unknown[]): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck: [],
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Source',
    updatedAt: 1_700_000_000_000,
  });

const frame = {
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
};

describe('applying a source to a frame', () => {
  it('stamps one figure inside the frame as one history entry', () => {
    const editor = createEditor(board([frame]));

    editor.applySource('frame-1', 'Box');

    const next = editor.getBoard();
    const figure = next.shapes.find((shape) => shape.parentId === 'frame-1');

    expect(figure?.kind).toBe('rectangle');
    expect(figure?.text).toBe('Box');
    expect(editor.getHistory().canUndo).toBe(true);

    const frameAfter = next.shapes.find((shape) => shape.id === 'frame-1');
    expect(frameAfter?.kind === 'frame' ? frameAfter.source : null).toEqual({
      generatedIds: [figure?.id],
      stale: false,
      text: 'Box',
    });
  });

  it('takes the whole apply back with one undo, and redo puts it back', () => {
    const editor = createEditor(board([frame]));

    editor.applySource('frame-1', 'Box');
    editor.undo();

    const undone = editor.getBoard();
    expect(undone.shapes).toHaveLength(1);
    expect(
      undone.shapes[0]?.kind === 'frame' ? undone.shapes[0].source : null
    ).toBeUndefined();

    editor.redo();

    const redone = editor.getBoard();
    expect(redone.shapes).toHaveLength(2);
    expect(redone.shapes[1]?.parentId).toBe('frame-1');
  });

  it("replaces the shapes a previous apply generated, and keeps the frame's own", () => {
    const editor = createEditor(board([frame]));

    editor.applySource('frame-1', 'First');
    editor.applySource('frame-1', 'Second');

    const next = editor.getBoard();
    const members = next.shapes.filter((shape) => shape.parentId === 'frame-1');

    expect(members).toHaveLength(1);
    expect(members[0]?.text).toBe('Second');
    const stored = next.shapes.find((shape) => shape.id === 'frame-1');
    expect(
      stored?.kind === 'frame' ? stored.source?.generatedIds : null
    ).toEqual([members[0]?.id]);
  });

  it('records an empty source and clears what it generated before', () => {
    const editor = createEditor(board([frame]));

    editor.applySource('frame-1', 'Box');
    editor.applySource('frame-1', '');

    const next = editor.getBoard();

    expect(next.shapes).toHaveLength(1);
    const [stored] = next.shapes;
    expect(stored?.kind === 'frame' ? stored.source : null).toEqual({
      generatedIds: [],
      stale: false,
      text: '',
    });
  });

  it('keeps an unreadable source as text without stamping anything', () => {
    const editor = createEditor(board([frame]));

    editor.applySource('frame-1', '->');

    const next = editor.getBoard();

    expect(next.shapes).toHaveLength(1);
    const [stored] = next.shapes;
    expect(stored?.kind === 'frame' ? stored.source : null).toEqual({
      generatedIds: [],
      stale: false,
      text: '->',
    });
  });

  it('does nothing when the id names no frame', () => {
    const editor = createEditor(board([frame]));

    editor.applySource('missing', 'Box');

    expect(editor.getBoard().shapes).toHaveLength(1);
    expect(editor.getHistory().canUndo).toBe(false);
  });
});
