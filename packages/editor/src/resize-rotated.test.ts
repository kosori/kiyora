import {
  createEditor,
  HANDLES,
  type HandleKind,
  resizeRefusal,
  resizeSelection,
} from '@kiyora/editor';
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

const rectangle = (overrides: Partial<FigureShape> = {}): Shape => ({
  h: 60,
  id: 'flat',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 100,
  x: 0,
  y: 0,
  ...overrides,
});

const board = (shapes: Shape[]): Board =>
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

/** One upright box and one turned square, whose selection box is 300 by 100. */
const members = (): Shape[] => [
  rectangle({ h: 50, id: 'flat', w: 100, x: 0, y: 0 }),
  rectangle({ h: 100, id: 'turned', rotation: 90, w: 100, x: 200, y: 0 }),
];

const bounds = { h: 100, w: 300, x: 0, y: 0 };
const exact = { fromCentre: false, keepRatio: false, snap: false };
const none = { bypassSnap: false, constrain: false } as const;

describe('a uniform resize of a selection holding a rotated shape', () => {
  it('scales its centre, size and angle about the anchor exactly', () => {
    const next = resizeSelection(
      members(),
      bounds,
      'se',
      { x: 450, y: 150 },
      exact
    );
    const turned = next.get('turned');

    expect(next.get('flat')).toMatchObject({
      h: 75,
      rotation: 0,
      w: 150,
      x: 0,
      y: 0,
    });
    expect(turned).toMatchObject({ h: 150, rotation: 90, w: 150 });
    expect((turned?.x ?? 0) + (turned?.w ?? 0) / 2).toBeCloseTo(375, 9);
    expect((turned?.y ?? 0) + (turned?.h ?? 0) / 2).toBeCloseTo(75, 9);
  });

  it('is applied by the store without a refusal at the same scale on both axes', () => {
    const editor = createEditor(board(members()));
    editor.setSelection(['flat', 'turned']);

    editor.pointerDown({ x: 300, y: 100 }, false);
    editor.pointerMove({ x: 480, y: 160 }, none);

    expect(editor.getGesture()).toEqual({
      guides: [],
      handle: 'se',
      kind: 'resize',
    });
    expect(editor.getBoard().shapes).toMatchObject([
      { h: 80, w: 160, x: 0, y: 0 },
      { h: 160, rotation: 90, w: 160, x: 320, y: 0 },
    ]);
  });
});

const upright = (): Shape[] => [
  rectangle({ h: 50, id: 'left', w: 100, x: 0, y: 0 }),
  rectangle({ h: 100, id: 'right', w: 100, x: 200, y: 0 }),
];

/** A pointer clear of each handle, so the drag is unambiguous. */
const beyond: Record<HandleKind, { x: number; y: number }> = {
  e: { x: 450, y: 50 },
  n: { x: 150, y: -50 },
  ne: { x: 350, y: -50 },
  nw: { x: -50, y: -50 },
  s: { x: 150, y: 150 },
  se: { x: 450, y: 150 },
  sw: { x: -50, y: 150 },
  w: { x: -50, y: 50 },
};

describe('an unrotated multi-selection', () => {
  it('keeps all eight handles exact', () => {
    for (const handle of HANDLES) {
      const pointer = beyond[handle];

      expect(
        resizeRefusal(upright(), bounds, handle, pointer, exact)
      ).toBeNull();
      expect(
        resizeSelection(upright(), bounds, handle, pointer, exact).size
      ).toBe(2);
    }
  });
});

describe('a non-uniform resize of a selection holding a rotated shape', () => {
  it('is refused at the seam with a reason, rather than skewing the box', () => {
    expect(() =>
      resizeSelection(members(), bounds, 'e', { x: 450, y: 50 }, exact)
    ).toThrow(/rotated shapes scale uniformly only/i);
  });

  it('leaves the board alone and says why in the open gesture', () => {
    const editor = createEditor(board(members()));
    editor.setSelection(['flat', 'turned']);
    const before = editor.getBoard();

    editor.pointerDown({ x: 300, y: 50 }, false);
    editor.pointerMove({ x: 450, y: 50 }, none);

    expect(editor.getBoard()).toBe(before);
    expect(editor.getGesture()).toMatchObject({
      handle: 'e',
      kind: 'resize',
      refusal: expect.stringMatching(/rotated shapes scale uniformly only/i),
    });
  });
});
