import {
  addSlide,
  type Board,
  DECK_TEMPLATES,
  deckFrames,
  deleteSlide,
  duplicateSlide,
  framesWithoutSlide,
  insertTemplateSlide,
  moveSlide,
  parseBoard,
  presentedSlides,
  SCHEMA_VERSION,
  type Style,
  setSlideNotes,
  toggleSlideSkipped,
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

const frame = (overrides: Record<string, unknown> = {}) => ({
  clip: true,
  h: 400,
  id: 'frame-1',
  kind: 'frame',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  variant: 'plain',
  w: 600,
  x: 0,
  y: 0,
  ...overrides,
});

const member = (overrides: Record<string, unknown> = {}) => ({
  h: 60,
  id: 'member-1',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: 'frame-1',
  rotation: 0,
  style,
  w: 100,
  x: 20,
  y: 20,
  ...overrides,
});

const board = (shapes: unknown[], deck: unknown[] = []): Board =>
  parseBoard({
    camera: { x: 0, y: 0, zoom: 1 },
    createdAt: 1_700_000_000_000,
    deck,
    id: 'board-1',
    schemaVersion: SCHEMA_VERSION,
    settings: { theme: 'light' },
    shapes,
    title: 'Untitled',
    updatedAt: 1_700_000_000_000,
  });

const slide = (frameId: string, notes = '', skipped = false) => ({
  frameId,
  notes,
  skipped,
});

describe('the deck template data', () => {
  it('offers five templates, each with its own id and a name a person reads', () => {
    expect(DECK_TEMPLATES).toHaveLength(5);

    const ids = DECK_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(5);
    for (const template of DECK_TEMPLATES) {
      expect(template.label.length).toBeGreaterThan(0);
      expect(template.frame.w).toBeGreaterThan(0);
      expect(template.frame.h).toBeGreaterThan(0);
    }
  });

  it('carries the shape of each slide as data, not as a branch in the editor', () => {
    const title = DECK_TEMPLATES.find((template) => template.id === 'title');
    const blank = DECK_TEMPLATES.find((template) => template.id === 'blank');

    expect(title?.pieces.length).toBeGreaterThan(0);
    expect(blank?.pieces).toEqual([]);
  });
});

describe('a board’s deck', () => {
  it('enumerates the frames it has made slides, in deck order', () => {
    const board1 = board(
      [frame({ id: 'frame-1' }), frame({ id: 'frame-2', x: 700 })],
      [slide('frame-2'), slide('frame-1')]
    );

    expect(deckFrames(board1).map((entry) => entry.frame.id)).toEqual([
      'frame-2',
      'frame-1',
    ]);
  });

  it('drops a deck entry whose frame is gone rather than showing a blank slide', () => {
    const board1 = board([frame({ id: 'frame-1' })], [slide('frame-9')]);

    expect(deckFrames(board1)).toEqual([]);
  });

  it('lists the frames not yet made slides, in paint order, so one can be added', () => {
    const board1 = board(
      [frame({ id: 'frame-1' }), frame({ id: 'frame-2', x: 700 })],
      [slide('frame-2')]
    );

    expect(framesWithoutSlide(board1).map((shape) => shape.id)).toEqual([
      'frame-1',
    ]);
  });

  it('plays the deck less what it skips, in order', () => {
    const board1 = board(
      [
        frame({ id: 'frame-1' }),
        frame({ id: 'frame-2', x: 700 }),
        frame({ id: 'frame-3', x: 1400 }),
      ],
      [slide('frame-1'), slide('frame-2', '', true), slide('frame-3')]
    );

    expect(presentedSlides(board1).map((entry) => entry.frame.id)).toEqual([
      'frame-1',
      'frame-3',
    ]);
  });
});

describe('building a deck', () => {
  it('makes a frame a slide with empty notes and no skip', () => {
    const board1 = addSlide(board([frame({ id: 'frame-1' })]), 'frame-1');

    expect(board1.deck).toEqual([slide('frame-1')]);
  });

  it('adds a slide once: a frame already in the deck is left alone', () => {
    const once = addSlide(board([frame({ id: 'frame-1' })]), 'frame-1');
    const twice = addSlide(once, 'frame-1');

    expect(twice.deck).toHaveLength(1);
  });

  it('refuses to make something that is not a frame a slide', () => {
    const board1 = board([member({ parentId: null })]);

    expect(addSlide(board1, 'member-1')).toBe(board1);
  });

  it('reorders the deck, so the story is the order the presenter wants', () => {
    const board1 = board(
      [frame({ id: 'frame-1' }), frame({ id: 'frame-2', x: 700 })],
      [slide('frame-1'), slide('frame-2')]
    );
    const moved = moveSlide(board1, 'frame-1', 1);

    expect(moved.deck.map((entry) => entry.frameId)).toEqual([
      'frame-2',
      'frame-1',
    ]);
  });

  it('writes notes against one slide, leaving the others alone', () => {
    const board1 = board(
      [frame({ id: 'frame-1' }), frame({ id: 'frame-2', x: 700 })],
      [slide('frame-1'), slide('frame-2')]
    );
    const noted = setSlideNotes(board1, 'frame-2', 'Say hello');

    expect(noted.deck).toEqual([
      slide('frame-1'),
      slide('frame-2', 'Say hello'),
    ]);
  });

  it('skips a slide without deleting the frame behind it', () => {
    const board1 = board([frame({ id: 'frame-1' })], [slide('frame-1')]);
    const skipped = toggleSlideSkipped(board1, 'frame-1');

    expect(skipped.deck).toEqual([slide('frame-1', '', true)]);
    expect(skipped.shapes).toHaveLength(1);
  });

  it('deletes a slide and the frame it shows, its members going with it', () => {
    const board1 = board(
      [
        frame({ id: 'frame-1' }),
        member({ id: 'member-1' }),
        frame({ id: 'frame-2', x: 700 }),
      ],
      [slide('frame-1'), slide('frame-2')]
    );
    const removed = deleteSlide(board1, 'frame-1');

    expect(removed.deck.map((entry) => entry.frameId)).toEqual(['frame-2']);
    expect(removed.shapes.map((shape) => shape.id)).toEqual(['frame-2']);
  });

  it('duplicates a slide as a new frame with its own members, keeping the notes', () => {
    const board1 = board(
      [frame({ id: 'frame-1' }), member({ id: 'member-1' })],
      [slide('frame-1', 'Keep me')]
    );
    const copied = duplicateSlide(board1, 'frame-1');

    expect(copied.deck.map((entry) => entry.notes)).toEqual([
      'Keep me',
      'Keep me',
    ]);
    const copyId = copied.deck[1]?.frameId;
    expect(copyId).toBeDefined();
    expect(copyId).not.toBe('frame-1');

    const copy = copied.shapes.find((shape) => shape.id === copyId);
    expect(copy?.kind).toBe('frame');
    const copiedMember = copied.shapes.find(
      (shape) => shape.parentId === copyId
    );
    expect(copiedMember?.id).not.toBe('member-1');
    expect(copiedMember?.kind).toBe('rectangle');
  });

  it('places a duplicated slide clear of the one it copies', () => {
    const board1 = board(
      [frame({ id: 'frame-1', w: 600, x: 40 })],
      [slide('frame-1')]
    );
    const copied = duplicateSlide(board1, 'frame-1');
    const copy = copied.shapes.find(
      (shape) => shape.id === copied.deck[1]?.frameId
    );

    expect(copy?.x).toBeGreaterThan(40 + 600);
  });
});

describe('a template', () => {
  it('plants its frame and its pieces, parented, wearing the given style', () => {
    const title = DECK_TEMPLATES.find((template) => template.id === 'title');
    if (title === undefined) {
      throw new Error('the title template is missing');
    }
    const planted = insertTemplateSlide(board([]), title, style);

    const frameId = planted.deck[0]?.frameId;
    const shape = planted.shapes.find((item) => item.id === frameId);
    expect(shape?.kind).toBe('frame');
    expect(shape?.style).toEqual(style);

    const pieces = planted.shapes.filter((item) => item.parentId === frameId);
    expect(pieces.length).toBe(title.pieces.length);
    for (const piece of pieces) {
      expect(piece.kind).toBe('text');
      expect(piece.text?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('lands a new slide clear of the frame already on the board', () => {
    const existing = board([frame({ id: 'frame-1', w: 600, x: 40 })]);
    const blank = DECK_TEMPLATES.find((template) => template.id === 'blank');
    if (blank === undefined) {
      throw new Error('the blank template is missing');
    }
    const planted = insertTemplateSlide(existing, blank, style);
    const frameId = planted.deck[0]?.frameId;
    const plant = planted.shapes.find((item) => item.id === frameId);

    expect(plant?.x).toBeGreaterThan(40 + 600);
  });

  it('notes the slide with the template’s own copy', () => {
    const quote = DECK_TEMPLATES.find((template) => template.id === 'quote');
    if (quote === undefined) {
      throw new Error('the quote template is missing');
    }
    const planted = insertTemplateSlide(board([]), quote, style);

    expect(planted.deck[0]?.notes).toBe(quote.notes);
  });
});
