import type { Board, FrameShape, Shape, Slide, Style } from './board/schema';
import { DEFAULT_TEXT_STYLE } from './text/style';

/**
 * The deck: the ordered list of a board's frames that a presenter plays. The
 * deck holds references, so the frames themselves stay ordinary shapes — a slide
 * is a frame with a deck entry, and every operation here is one edit of the
 * authored board.
 */

/** The gap a new slide keeps from the board's other frames, in board units. */
const SLIDE_GAP = 80;

/** One frame the deck plays, with the entry that describes how it plays. */
export type DeckEntry = {
  frame: FrameShape;
  slide: Slide;
};

/**
 * One text a template lays inside its slide, positioned relative to the frame's
 * top-left. The template is data: the editor maps over it rather than branching
 * on which template was chosen.
 */
export type TemplatePiece = {
  h: number;
  /** The text size the piece wears, taken from the text presets. */
  size: number;
  text: string;
  w: number;
  x: number;
  y: number;
};

/** A deck template: the slide frame it plants, the text inside it, and its notes. */
export type DeckTemplate = {
  frame: { h: number; w: number };
  id: string;
  label: string;
  notes: string;
  pieces: readonly TemplatePiece[];
};

/**
 * The five templates a deck can start from, authored as data. Each is the same
 * 16:9 frame; only the ink inside it and the notes differ, so the editor that
 * plants one needs no case for any of them.
 */
export const DECK_TEMPLATES: readonly DeckTemplate[] = [
  {
    frame: { h: 720, w: 1280 },
    id: 'title',
    label: 'Title',
    notes: 'Open with the title.',
    pieces: [{ h: 200, size: 32, text: 'Title', w: 1040, x: 120, y: 260 }],
  },
  {
    frame: { h: 720, w: 1280 },
    id: 'title-and-content',
    label: 'Title and content',
    notes: 'One heading, one body.',
    pieces: [
      { h: 120, size: 32, text: 'Title', w: 1040, x: 120, y: 100 },
      { h: 420, size: 16, text: 'Body', w: 1040, x: 120, y: 260 },
    ],
  },
  {
    frame: { h: 720, w: 1280 },
    id: 'two-columns',
    label: 'Two columns',
    notes: 'Two bodies side by side.',
    pieces: [
      { h: 120, size: 32, text: 'Title', w: 1040, x: 120, y: 100 },
      { h: 420, size: 16, text: 'Left', w: 460, x: 120, y: 260 },
      { h: 420, size: 16, text: 'Right', w: 460, x: 700, y: 260 },
    ],
  },
  {
    frame: { h: 720, w: 1280 },
    id: 'quote',
    label: 'Quote',
    notes: 'Let the quote carry the slide.',
    pieces: [{ h: 280, size: 24, text: 'Quote', w: 960, x: 160, y: 220 }],
  },
  {
    frame: { h: 720, w: 1280 },
    id: 'blank',
    label: 'Blank',
    notes: '',
    pieces: [],
  },
];

/** Whether `shape` is a frame: the only shape a deck entry can point at. */
const isFrame = (shape: Shape): shape is FrameShape => shape.kind === 'frame';

/**
 * The first `<base>-<n>` id `used` does not hold, recorded in `used`. A new slide
 * mints its shapes the way the rest of the app mints them, so the ids a board
 * gains from a template read like the ones it gains from a tool.
 */
export const nextId = (base: string, used: Set<string>): string => {
  let n = 1;
  while (used.has(`${base}-${n}`)) {
    n += 1;
  }
  const id = `${base}-${n}`;
  used.add(id);

  return id;
};

/**
 * The frames a board holds, in paint order. The deck is an order over this list,
 * so the frames themselves keep one ordering and the deck adds no second.
 */
const framesOf = (board: Board): FrameShape[] => board.shapes.filter(isFrame);

/** `ids` and everything held inside them, the roots included, in paint order. */
export const subtreeIds = (board: Board, ids: readonly string[]): string[] => {
  const wanted = new Set(ids);

  let grew = true;
  while (grew) {
    grew = false;
    for (const shape of board.shapes) {
      if (
        shape.parentId !== null &&
        wanted.has(shape.parentId) &&
        !wanted.has(shape.id)
      ) {
        wanted.add(shape.id);
        grew = true;
      }
    }
  }

  return board.shapes
    .filter((shape) => wanted.has(shape.id))
    .map((shape) => shape.id);
};

/**
 * Where a new slide lands: clear to the right of the rightmost frame, its top
 * aligned with the topmost, so a deck reads left to right. A board with no
 * frames starts at the origin.
 */
const nextSlideOrigin = (board: Board): { x: number; y: number } => {
  const frames = framesOf(board);
  if (frames.length === 0) {
    return { x: 0, y: 0 };
  }

  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  for (const frame of frames) {
    right = Math.max(right, frame.x + frame.w);
    top = Math.min(top, frame.y);
  }

  return { x: right + SLIDE_GAP, y: top };
};

/** The deck entries whose frames are still on the board, in deck order. */
export const deckFrames = (board: Board): DeckEntry[] =>
  board.deck.flatMap((slide) => {
    const frame = board.shapes.find((shape) => shape.id === slide.frameId);

    return frame !== undefined && isFrame(frame) ? [{ frame, slide }] : [];
  });

/** The slides presenting plays: the deck less what it skips, in order. */
export const presentedSlides = (board: Board): DeckEntry[] =>
  deckFrames(board).filter((entry) => !entry.slide.skipped);

/** The frames that are not slides yet, in paint order, so one can be added. */
export const framesWithoutSlide = (board: Board): FrameShape[] => {
  const inDeck = new Set(board.deck.map((slide) => slide.frameId));

  return framesOf(board).filter((frame) => !inDeck.has(frame.id));
};

/**
 * Makes `frameId` a slide: the entry is appended, so a frame added to the deck
 * lands at the end of the story. A frame already in the deck, or an id that
 * names no frame, leaves the board as it was.
 */
export const addSlide = (board: Board, frameId: string): Board => {
  const frame = board.shapes.find((shape) => shape.id === frameId);
  if (
    frame === undefined ||
    !isFrame(frame) ||
    board.deck.some((slide) => slide.frameId === frameId)
  ) {
    return board;
  }

  return {
    ...board,
    deck: [...board.deck, { frameId, notes: '', skipped: false }],
  };
};

/**
 * Moves the slide for `frameId` to deck position `to`, clamped into range.
 */
export const moveSlide = (board: Board, frameId: string, to: number): Board => {
  const from = board.deck.findIndex((slide) => slide.frameId === frameId);
  if (from === -1) {
    return board;
  }
  const clamped = Math.max(0, Math.min(to, board.deck.length - 1));
  if (clamped === from) {
    return board;
  }

  const deck = [...board.deck];
  const [entry] = deck.splice(from, 1);
  if (entry === undefined) {
    return board;
  }
  deck.splice(clamped, 0, entry);

  return { ...board, deck };
};

/** Replaces one slide's notes, leaving every other entry alone. */
export const setSlideNotes = (
  board: Board,
  frameId: string,
  notes: string
): Board => {
  let changed = false;
  const deck = board.deck.map((slide) => {
    if (slide.frameId !== frameId || slide.notes === notes) {
      return slide;
    }
    changed = true;
    return { ...slide, notes };
  });

  return changed ? { ...board, deck } : board;
};

/** Flips one slide's skip flag, so it is held back without being deleted. */
export const toggleSlideSkipped = (board: Board, frameId: string): Board => {
  let changed = false;
  const deck = board.deck.map((slide) => {
    if (slide.frameId !== frameId) {
      return slide;
    }
    changed = true;
    return { ...slide, skipped: !slide.skipped };
  });

  return changed ? { ...board, deck } : board;
};

/**
 * Deletes the slide for `frameId`: the entry goes, and so does the frame it
 * showed together with everything held inside it, because a slide is a frame.
 * Skipping, not deleting, is how material is held back instead.
 */
export const deleteSlide = (board: Board, frameId: string): Board => {
  const frame = board.shapes.find((shape) => shape.id === frameId);
  if (frame === undefined || !isFrame(frame)) {
    return board;
  }
  const removed = new Set(subtreeIds(board, [frameId]));

  return {
    ...board,
    deck: board.deck.filter((slide) => slide.frameId !== frameId),
    shapes: board.shapes.filter((shape) => !removed.has(shape.id)),
  };
};

/**
 * Duplicates the slide for `frameId`: a fresh frame with its own members, the
 * same notes, placed clear of the original and inserted right after it. Shape
 * ids are minted fresh, and every member's `parentId` is remapped to the copy's
 * frame, so the two slides are independent.
 */
export const duplicateSlide = (board: Board, frameId: string): Board => {
  const index = board.deck.findIndex((slide) => slide.frameId === frameId);
  const source = board.shapes.find((shape) => shape.id === frameId);
  if (index === -1 || source === undefined || !isFrame(source)) {
    return board;
  }

  const subtree = new Set(subtreeIds(board, [frameId]));
  const used = new Set(board.shapes.map((shape) => shape.id));
  const remap = new Map<string, string>();
  for (const shape of board.shapes) {
    if (subtree.has(shape.id)) {
      remap.set(shape.id, nextId(shape.kind, used));
    }
  }
  const copyId = remap.get(frameId);
  if (copyId === undefined) {
    return board;
  }

  const origin = nextSlideOrigin(board);
  const dx = origin.x - source.x;
  const dy = origin.y - source.y;
  const copies: Shape[] = board.shapes
    .filter((shape) => subtree.has(shape.id))
    .map((shape) => ({
      ...shape,
      id: remap.get(shape.id) ?? shape.id,
      parentId:
        shape.parentId === null
          ? null
          : (remap.get(shape.parentId) ?? shape.parentId),
      x: shape.x + dx,
      y: shape.y + dy,
    }));

  const deck = [...board.deck];
  deck.splice(index + 1, 0, {
    frameId: copyId,
    notes: board.deck[index]?.notes ?? '',
    skipped: false,
  });

  return { ...board, deck, shapes: [...board.shapes, ...copies] };
};

/**
 * Plants `template` on the board as a new slide: the frame, the text pieces it
 * carries as members, and a deck entry noted with the template's copy. The
 * shapes wear `style`, so a template can be authored once and dressed by the
 * board it lands on.
 */
export const insertTemplateSlide = (
  board: Board,
  template: DeckTemplate,
  style: Style
): Board => {
  const used = new Set(board.shapes.map((shape) => shape.id));
  const origin = nextSlideOrigin(board);
  const frameId = nextId('frame', used);
  const frame: FrameShape = {
    clip: true,
    h: template.frame.h,
    id: frameId,
    kind: 'frame',
    locked: false,
    opacity: 1,
    parentId: null,
    rotation: 0,
    style,
    variant: 'plain',
    w: template.frame.w,
    x: origin.x,
    y: origin.y,
  };
  const pieces: Shape[] = template.pieces.map((piece) => ({
    h: piece.h,
    id: nextId('text', used),
    kind: 'text',
    locked: false,
    opacity: 1,
    parentId: frameId,
    rotation: 0,
    style,
    text: piece.text,
    textStyle: { ...DEFAULT_TEXT_STYLE, size: piece.size },
    w: piece.w,
    x: origin.x + piece.x,
    y: origin.y + piece.y,
  }));

  return {
    ...board,
    deck: [...board.deck, { frameId, notes: template.notes, skipped: false }],
    shapes: [...board.shapes, frame, ...pieces],
  };
};
