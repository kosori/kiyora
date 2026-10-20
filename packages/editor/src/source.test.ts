import { createEditor, sourceState } from '@kiyora/editor';
import {
  type Board,
  type FigureShape,
  parseBoard,
  SCHEMA_VERSION,
  type Shape,
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

const generated = (overrides: Partial<FigureShape> = {}): Shape => ({
  h: 100,
  id: 'rectangle-1',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: 'frame-1',
  rotation: 0,
  style,
  text: 'Box',
  w: 160,
  x: 124,
  y: 124,
  ...overrides,
});

const sourcedFrame = (stale = false, generatedIds = ['rectangle-1']) => ({
  ...frame,
  source: { generatedIds, stale, text: 'Box' },
});

const none = { bypassSnap: false, constrain: false } as const;

/** The frame `id` names, or `undefined` when the board holds none. */
const frameOf = (editor: ReturnType<typeof createEditor>, id: string) => {
  const shape = editor.getBoard().shapes.find((one) => one.id === id);

  return shape?.kind === 'frame' ? shape : undefined;
};

describe('the two source states', () => {
  it('reads pending only while the draft differs from the applied text', () => {
    const source = { generatedIds: ['rectangle-1'], stale: false, text: 'Box' };

    expect(sourceState(source, 'Box')).toEqual({
      pending: false,
      stale: false,
    });
    expect(sourceState(source, 'Box and more')).toEqual({
      pending: true,
      stale: false,
    });
  });

  it('keeps pending and stale apart when both are true', () => {
    const source = { generatedIds: ['rectangle-1'], stale: true, text: 'Box' };

    expect(sourceState(source, 'Box and more')).toEqual({
      pending: true,
      stale: true,
    });
    expect(sourceState(source, 'Box')).toEqual({ pending: false, stale: true });
  });
});

describe('a generated shape edited by hand marks its frame stale', () => {
  it('on a nudge', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));
    editor.setSelection(['rectangle-1']);

    editor.nudge(8, 0);

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);
  });

  it('on a move drag', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));
    editor.setSelection(['rectangle-1']);

    editor.pointerDown({ x: 180, y: 160 }, false);
    editor.pointerMove({ x: 200, y: 160 }, none);
    editor.pointerUp();

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);
  });

  it('on a resize', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));
    editor.setSelection(['rectangle-1']);

    editor.pointerDown({ x: 284, y: 224 }, false);
    editor.pointerMove({ x: 300, y: 240 }, none);
    editor.pointerUp();

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);
  });

  it('on a rotate', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));
    editor.setSelection(['rectangle-1']);

    editor.pointerDown({ x: 204, y: 102 }, false);
    editor.pointerMove({ x: 260, y: 160 }, none);
    editor.pointerUp();

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);
  });

  it('on a restyle', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));
    editor.setSelection(['rectangle-1']);

    editor.restyle({ style: { fill: 'red' } });

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);
  });

  it('on a text edit', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));

    editor.setText('rectangle-1', 'Hand written');

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);
  });

  it('on a delete', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));
    editor.setSelection(['rectangle-1']);

    editor.deleteSelection();

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);
    expect(editor.getBoard().shapes).toHaveLength(1);
  });

  it('leaves a hand-added shape inside the frame out of it', () => {
    const editor = createEditor(
      board([
        sourcedFrame(),
        generated(),
        generated({ id: 'hand-1', parentId: 'frame-1', text: 'Mine' }),
      ])
    );
    editor.setSelection(['hand-1']);

    editor.nudge(8, 0);

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(false);
  });

  it('is restored by undo and set again by redo', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));
    editor.setSelection(['rectangle-1']);

    editor.nudge(8, 0);
    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);

    editor.undo();
    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(false);
    expect(
      editor.getBoard().shapes.find((shape) => shape.id === 'rectangle-1')
    ).toMatchObject({ x: 124 });

    editor.redo();
    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(true);
  });

  it('stays alone when the camera, the selection or the theme changes', () => {
    const editor = createEditor(board([sourcedFrame(), generated()]));

    editor.setCamera({ x: 40, y: 40, zoom: 2 });
    editor.setSelection(['rectangle-1']);
    editor.setBoard({
      ...editor.getBoard(),
      settings: { theme: 'dark' },
    });

    expect(frameOf(editor, 'frame-1')?.source?.stale).toBe(false);
  });
});

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

    expect(editor.applySource('missing', 'Box')).toBe('missing');

    expect(editor.getBoard().shapes).toHaveLength(1);
    expect(editor.getHistory().canUndo).toBe(false);
  });
});

describe('the apply contract', () => {
  it('applies a fresh frame silently', () => {
    const editor = createEditor(board([sourcedFrame()]));

    expect(editor.applySource('frame-1', 'Next')).toBe('applied');
    expect(frameOf(editor, 'frame-1')?.source).toMatchObject({
      stale: false,
      text: 'Next',
    });
  });

  it('asks before it replaces a stale frame, changing nothing until told', () => {
    const editor = createEditor(board([sourcedFrame(true), generated()]));
    const before = editor.getBoard();

    expect(editor.applySource('frame-1', 'Next')).toBe('needs-confirm');

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory().canUndo).toBe(false);
    expect(editor.getBoard().shapes).toHaveLength(2);
  });

  it('applies a stale frame once the caller confirms', () => {
    const editor = createEditor(board([sourcedFrame(true), generated()]));

    expect(editor.applySource('frame-1', 'Next', { force: true })).toBe(
      'applied'
    );

    const stored = frameOf(editor, 'frame-1');
    expect(stored?.source).toMatchObject({ stale: false, text: 'Next' });
    expect(stored?.source?.generatedIds).toEqual(['rectangle-1']);
  });

  it('replaces exactly the generated ids, so a hand-added shape survives', () => {
    const hand = generated({ id: 'hand-1', parentId: 'frame-1', text: 'Mine' });
    const editor = createEditor(
      board([sourcedFrame(false, ['old-1']), generated({ id: 'old-1' }), hand])
    );

    editor.applySource('frame-1', 'Next');

    const { shapes } = editor.getBoard();
    expect(shapes.find((shape) => shape.id === 'hand-1')).toEqual(hand);
    expect(shapes.find((shape) => shape.id === 'old-1')).toBeUndefined();
    expect(shapes.find((shape) => shape.id === 'rectangle-1')).toMatchObject({
      text: 'Next',
    });
  });
});

describe('the frame around an applied diagram', () => {
  const smallFrame = { ...frame, h: 100, w: 100 };
  const sizeOf = (editor: ReturnType<typeof createEditor>) => {
    const stored = frameOf(editor, 'frame-1');

    return { h: stored?.h, w: stored?.w };
  };

  it('grows to hold a diagram that does not fit', () => {
    const editor = createEditor(board([smallFrame]));

    editor.applySource('frame-1', 'Box');

    expect(sizeOf(editor)).toEqual({ h: 148, w: 208 });
  });

  it('never shrinks, even when the next source stamps nothing', () => {
    const editor = createEditor(board([smallFrame]));

    editor.applySource('frame-1', 'Box');
    editor.applySource('frame-1', '');

    expect(sizeOf(editor)).toEqual({ h: 148, w: 208 });
  });
});
