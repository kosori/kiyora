import { createEditor, isFigureTool, isShapeTool } from '@kiyora/editor';
import {
  type Board,
  DEFAULT_TEXT_STYLE,
  type Measurer,
  NOTE_STYLE,
  parseBoard,
  SCHEMA_VERSION,
  type StickyShape,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

/** A deterministic measurer: every character is half the run's size wide. */
const fake: Measurer = (run) => run.text.length * run.size * 0.5;

const LONG =
  'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty';

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

const sticky = (overrides: Partial<StickyShape> = {}): StickyShape => ({
  h: 160,
  id: 'sticky-1',
  kind: 'sticky',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style: NOTE_STYLE,
  text: '',
  textStyle: DEFAULT_TEXT_STYLE,
  w: 160,
  x: 0,
  y: 0,
  ...overrides,
});

describe('the sticky tool', () => {
  it('is a shape tool, but no figure, so the picker leaves it to the rail', () => {
    expect(isShapeTool('sticky')).toBe(true);
    expect(isFigureTool('sticky')).toBe(false);
  });

  it('places an empty note wearing the note colour and centred text', () => {
    const editor = createEditor(board());
    editor.setTool('sticky');

    const placed = editor.placeShape(click(400, 300));

    expect(placed).toMatchObject({
      kind: 'sticky',
      text: '',
      textStyle: DEFAULT_TEXT_STYLE,
    });
    expect(placed?.style?.fill).toBe('yellow');
    expect(placed?.style?.fillStyle).toBe('bold');
  });

  it('gives a sticky its own id series', () => {
    const editor = createEditor(board());
    editor.setTool('sticky');
    editor.placeShape(click(100, 100));
    editor.setTool('sticky');
    editor.placeShape(click(300, 300));

    expect(editor.getBoard().shapes.map((shape) => shape.id)).toEqual([
      'sticky-1',
      'sticky-2',
    ]);
  });
});

describe('a sticky grows with its label', () => {
  it('grows the box downward to fit a long label, keeping its corner and width', () => {
    const editor = createEditor(board([sticky()]));
    const before = editor.getBoard().shapes[0] as StickyShape;

    editor.setText('sticky-1', LONG, fake);

    const after = editor.getBoard().shapes[0] as StickyShape;
    expect(after.h).toBeGreaterThan(before.h);
    expect(after.w).toBe(before.w);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });

  it('leaves a note with room for a short label alone', () => {
    const editor = createEditor(board([sticky()]));

    editor.setText('sticky-1', 'hi', fake);

    const after = editor.getBoard().shapes[0] as StickyShape;
    expect(after.h).toBe(160);
  });

  it('does not grow a figure when its label grows, so only a note grows', () => {
    const editor = createEditor(
      board([
        {
          h: 100,
          id: 'rectangle-1',
          kind: 'rectangle',
          locked: false,
          opacity: 1,
          parentId: null,
          rotation: 0,
          style: NOTE_STYLE,
          w: 160,
          x: 0,
          y: 0,
        },
      ])
    );

    editor.setText('rectangle-1', LONG, fake);

    expect(editor.getBoard().shapes[0]?.h).toBe(100);
  });

  it('does not move a neighbour when a sticky grows', () => {
    const editor = createEditor(
      board([sticky(), { ...sticky({ id: 'sibling', x: 400 }) }])
    );
    const sibling = { ...editor.getBoard().shapes[1] };

    editor.setText('sticky-1', LONG, fake);

    expect(editor.getBoard().shapes[1]).toEqual(sibling);
  });

  it('does not resize a frame the sticky sits in', () => {
    const frame = {
      clip: true,
      h: 400,
      id: 'frame-1',
      kind: 'frame' as const,
      locked: false,
      opacity: 1,
      parentId: null,
      rotation: 0,
      style: NOTE_STYLE,
      variant: 'plain' as const,
      w: 600,
      x: 0,
      y: 0,
    };
    const editor = createEditor(
      board([frame, sticky({ parentId: 'frame-1', x: 40, y: 40 })])
    );

    editor.setText('sticky-1', LONG, fake);

    const [kept, member] = editor.getBoard().shapes;
    expect(kept).toEqual(frame);
    expect(member?.parentId).toBe('frame-1');
  });
});

describe('undoing a sticky\u2019s label edit', () => {
  it('puts the box back as well as the words, so a grown note shrinks back', () => {
    const editor = createEditor(board([sticky()]));
    const before = editor.getBoard();

    editor.beginTextEdit();
    editor.setText('sticky-1', LONG, fake);
    editor.endTextEdit();

    expect((editor.getBoard().shapes[0] as StickyShape).h).toBeGreaterThan(160);

    editor.undo();

    expect(editor.getBoard()).toBe(before);
    expect((editor.getBoard().shapes[0] as StickyShape).h).toBe(160);
    expect(editor.getBoard().shapes[0]?.text).toBe('');
  });
});
