import { createEditor, type Editor } from '@kiyora/editor';
import { type Board, parseBoard } from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const style = {
  corner: 'sharp',
  dash: 'solid',
  fill: 'blue',
  fillStyle: 'pastel',
  stroke: 'ink',
  strokeWidth: 2,
} as const;

const frame = (
  id: string,
  x: number,
  overrides: Record<string, unknown> = {}
) => ({
  clip: true,
  h: 400,
  id,
  kind: 'frame',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  variant: 'plain',
  w: 600,
  x,
  y: 0,
  ...overrides,
});

const member = (id: string, parentId: string) => ({
  h: 60,
  id,
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId,
  rotation: 0,
  style,
  w: 100,
  x: 20,
  y: 20,
});

const board = (shapes: unknown[], deck: unknown[] = []): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck,
    id: 'board-1',
    schemaVersion: 1,
    settings: { theme: 'light' },
    shapes,
    title: 'Untitled',
    updatedAt: 1_700_000_000_000,
  });

const twoFrames = (): Board =>
  board([frame('frame-1', 0), frame('frame-2', 700)]);

const editorOf = (shape: Board): Editor => createEditor(shape);

describe('editing the deck', () => {
  it('makes a frame a slide as one gesture, so one undo takes it back', () => {
    const editor = editorOf(twoFrames());

    editor.addSlide('frame-1');
    expect(editor.getBoard().deck).toHaveLength(1);
    expect(editor.getHistory().canUndo).toBe(true);

    editor.undo();
    expect(editor.getBoard().deck).toHaveLength(0);
  });

  it('deletes a slide with the frame it showed, and undo brings both back', () => {
    const editor = editorOf(
      board(
        [frame('frame-1', 0), member('member-1', 'frame-1')],
        [{ frameId: 'frame-1', notes: '', skipped: false }]
      )
    );

    editor.deleteSlide('frame-1');
    expect(editor.getBoard().shapes).toHaveLength(0);
    expect(editor.getBoard().deck).toHaveLength(0);

    editor.undo();
    expect(editor.getBoard().shapes).toHaveLength(2);
    expect(editor.getBoard().deck).toHaveLength(1);
  });

  it('duplicates a slide with fresh ids in one gesture', () => {
    const editor = editorOf(
      board(
        [frame('frame-1', 0)],
        [{ frameId: 'frame-1', notes: 'Notes', skipped: false }]
      )
    );

    editor.duplicateSlide('frame-1');

    expect(editor.getBoard().deck).toHaveLength(2);
    expect(editor.getBoard().deck[0]?.frameId).not.toBe(
      editor.getBoard().deck[1]?.frameId
    );
  });

  it('reorders the deck, and skip toggles the flag without dropping the frame', () => {
    const editor = editorOf(
      board(
        [frame('frame-1', 0), frame('frame-2', 700)],
        [
          { frameId: 'frame-1', notes: '', skipped: false },
          { frameId: 'frame-2', notes: '', skipped: false },
        ]
      )
    );

    editor.moveSlide('frame-1', 1);
    expect(editor.getBoard().deck.map((slide) => slide.frameId)).toEqual([
      'frame-2',
      'frame-1',
    ]);

    editor.toggleSlideSkip('frame-2');
    expect(editor.getBoard().deck[0]?.skipped).toBe(true);
    expect(editor.getBoard().shapes).toHaveLength(2);
  });

  it('writes slide notes as one gesture', () => {
    const editor = editorOf(
      board(
        [frame('frame-1', 0)],
        [{ frameId: 'frame-1', notes: '', skipped: false }]
      )
    );

    editor.setSlideNotes('frame-1', 'Say hello');
    expect(editor.getBoard().deck[0]?.notes).toBe('Say hello');

    editor.undo();
    expect(editor.getBoard().deck[0]?.notes).toBe('');
  });

  it('plants a template as a frame, its pieces and a slide, in one gesture', () => {
    const editor = editorOf(board([]));

    editor.addSlideFromTemplate('title');

    const planted = editor.getBoard();
    expect(planted.deck).toHaveLength(1);
    expect(planted.shapes.length).toBeGreaterThan(1);
    expect(editor.getHistory().canUndo).toBe(true);
  });
});

describe('presenting', () => {
  const withSlides = (): Editor =>
    editorOf(
      board(
        [frame('frame-1', 0), frame('frame-2', 700), frame('frame-3', 1400)],
        [
          { frameId: 'frame-1', notes: 'First', skipped: false },
          { frameId: 'frame-2', notes: 'Skipped', skipped: true },
          { frameId: 'frame-3', notes: 'Last', skipped: false },
        ]
      )
    );

  it('shows the first slide and steps over the skipped one', () => {
    const editor = withSlides();

    editor.startPresent();
    expect(editor.getPresent()).toMatchObject({ active: true, index: 0 });

    editor.nextSlide();
    expect(editor.getPresent().index).toBe(1);
    expect(editor.getBoard().deck[2]?.frameId).toBe('frame-3');
  });

  it('clamps at the ends, so a held key does not run off the deck', () => {
    const editor = withSlides();

    editor.startPresent();
    editor.previousSlide();
    expect(editor.getPresent().index).toBe(0);

    editor.nextSlide();
    editor.nextSlide();
    editor.nextSlide();
    expect(editor.getPresent().index).toBe(1);
  });

  it('starts from nothing, so a board with no slides cannot present', () => {
    const editor = editorOf(board([]));

    editor.startPresent();
    expect(editor.getPresent().active).toBe(false);
  });

  it('changes nothing on the board: no board notification, no history, no save', () => {
    const editor = withSlides();
    const before = editor.getBoard();
    const history = editor.getHistory();
    let boardNotifications = 0;
    editor.subscribe(() => {
      boardNotifications += 1;
    });

    editor.startPresent();
    editor.nextSlide();
    editor.previousSlide();
    editor.toggleNotes();
    editor.toggleTimer();
    editor.stopPresent();

    expect(editor.getBoard()).toBe(before);
    expect(editor.getHistory()).toEqual(history);
    expect(boardNotifications).toBe(0);
  });

  it('toggles the notes and the timer, and returns to editing on stop', () => {
    const editor = withSlides();

    editor.startPresent();
    expect(editor.getPresent()).toMatchObject({ notes: true, timer: true });

    editor.toggleNotes();
    editor.toggleTimer();
    expect(editor.getPresent()).toMatchObject({ notes: false, timer: false });

    editor.stopPresent();
    expect(editor.getPresent().active).toBe(false);
  });

  it('notifies its own subscribers without waking the board', () => {
    const editor = withSlides();
    const seen: number[] = [];
    editor.subscribePresent(() => seen.push(editor.getPresent().index));

    editor.startPresent();
    editor.nextSlide();

    expect(seen).toEqual([0, 1]);
  });
});
