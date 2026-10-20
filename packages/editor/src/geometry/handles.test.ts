import {
  angleAt,
  HANDLES,
  handleAt,
  handlePositions,
  MIN_SIZE,
  NO_GESTURE_MODIFIERS,
  resizeBounds,
  resizeSelection,
  rotateHandlePosition,
  rotateSelection,
  settleRotation,
} from '@kiyora/editor';
import type { FigureShape, Shape } from '@kiyora/model';
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
  h: 140,
  id: 'r',
  kind: 'rectangle',
  locked: false,
  opacity: 1,
  parentId: null,
  rotation: 0,
  style,
  w: 220,
  x: 80,
  y: 80,
  ...overrides,
});

const noModifiers = {
  fromCentre: false,
  keepRatio: false,
  snap: false,
} as const;

describe('the handles', () => {
  it('sits one on each corner and edge midpoint, eight in all', () => {
    expect(HANDLES).toHaveLength(8);
    expect(handlePositions({ h: 140, w: 220, x: 80, y: 80 })).toEqual({
      e: { x: 300, y: 150 },
      n: { x: 190, y: 80 },
      ne: { x: 300, y: 80 },
      nw: { x: 80, y: 80 },
      s: { x: 190, y: 220 },
      se: { x: 300, y: 220 },
      sw: { x: 80, y: 220 },
      w: { x: 80, y: 150 },
    });
  });

  it('floats the rotate handle a fixed distance above the top edge', () => {
    const bounds = { h: 140, w: 220, x: 80, y: 80 };

    expect(rotateHandlePosition(bounds, 1)).toEqual({ x: 190, y: 58 });
    expect(rotateHandlePosition(bounds, 2)).toEqual({ x: 190, y: 69 });
  });

  it('names the handle under the pointer', () => {
    const bounds = { h: 140, w: 220, x: 80, y: 80 };

    expect(handleAt(bounds, { x: 300, y: 220 }, 1)).toBe('se');
    expect(handleAt(bounds, { x: 300, y: 150 }, 1)).toBe('e');
    expect(handleAt(bounds, { x: 190, y: 58 }, 1)).toBe('rotate');
    expect(handleAt(bounds, { x: 190, y: 150 }, 1)).toBeNull();
  });

  it('keeps the same reach on screen however far the camera is out', () => {
    const bounds = { h: 140, w: 220, x: 80, y: 80 };

    expect(handleAt(bounds, { x: 305, y: 220 }, 1)).toBe('se');
    expect(handleAt(bounds, { x: 311, y: 220 }, 1)).toBeNull();
    expect(handleAt(bounds, { x: 311, y: 220 }, 0.5)).toBe('se');
  });
});

describe('resizing the selection box', () => {
  const bounds = { h: 140, w: 220, x: 80, y: 80 };

  it('moves the corner an edge handle is dragged from', () => {
    expect(resizeBounds(bounds, 'se', { x: 360, y: 300 }, noModifiers)).toEqual(
      {
        h: 220,
        w: 280,
        x: 80,
        y: 80,
      }
    );
  });

  it('moves only the edge an edge handle drags', () => {
    expect(resizeBounds(bounds, 'e', { x: 360, y: 500 }, noModifiers)).toEqual({
      h: 140,
      w: 280,
      x: 80,
      y: 80,
    });
  });

  it('never inverts, holding a minimum size', () => {
    expect(resizeBounds(bounds, 'se', { x: 85, y: 85 }, noModifiers)).toEqual({
      h: MIN_SIZE,
      w: MIN_SIZE,
      x: 80,
      y: 80,
    });
  });

  it('preserves the ratio with shift', () => {
    const box = { h: 50, w: 100, x: 0, y: 0 };

    expect(
      resizeBounds(
        box,
        'se',
        { x: 200, y: 75 },
        {
          ...noModifiers,
          keepRatio: true,
        }
      )
    ).toEqual({ h: 100, w: 200, x: 0, y: 0 });
  });

  it('grows from the centre with alt', () => {
    expect(
      resizeBounds(
        bounds,
        'se',
        { x: 340, y: 260 },
        {
          ...noModifiers,
          fromCentre: true,
        }
      )
    ).toEqual({ h: 220, w: 300, x: 40, y: 40 });
  });

  it('lands the dragged edge on the grid', () => {
    expect(
      resizeBounds(
        bounds,
        'se',
        { x: 363, y: 299 },
        {
          ...noModifiers,
          snap: true,
        }
      )
    ).toEqual({ h: 216, w: 280, x: 80, y: 80 });
  });
});

describe('resizing a shape', () => {
  const bounds = { h: 140, w: 220, x: 80, y: 80 };

  it('scales the box a corner drags, holding the opposite corner', () => {
    const next = resizeSelection(
      [rectangle()],
      bounds,
      'se',
      { x: 360, y: 300 },
      noModifiers
    ).get('r');

    expect(next).toMatchObject({ h: 220, w: 280, x: 80, y: 80 });
  });

  it('holds a minimum size rather than inverting', () => {
    const next = resizeSelection(
      [rectangle()],
      bounds,
      'se',
      { x: 85, y: 85 },
      noModifiers
    ).get('r');

    expect(next).toMatchObject({ h: MIN_SIZE, w: MIN_SIZE, x: 80, y: 80 });
  });

  it('resizes a rotated shape in its own frame, pinning the anchor corner', () => {
    const turned = rectangle({ h: 100, rotation: 90, w: 100, x: 0, y: 0 });
    const next = resizeSelection(
      [turned],
      { h: 100, w: 100, x: 0, y: 0 },
      'se',
      { x: 50, y: 150 },
      noModifiers
    ).get('r');

    expect(next).toMatchObject({ h: 50, rotation: 90, w: 150, x: 0, y: 50 });
  });

  it('resizes a group from the selection box, keeping relative positions', () => {
    const next = resizeSelection(
      [
        rectangle({ h: 100, id: 'a', w: 100, x: 0, y: 0 }),
        rectangle({ h: 100, id: 'b', w: 100, x: 200, y: 0 }),
      ],
      { h: 100, w: 300, x: 0, y: 0 },
      'e',
      { x: 600, y: 0 },
      noModifiers
    );

    expect(next.get('a')).toMatchObject({ w: 200, x: 0 });
    expect(next.get('b')).toMatchObject({ w: 200, x: 400 });
  });

  it('keeps the smallest member of a group above the minimum', () => {
    const next = resizeSelection(
      [
        rectangle({ h: 100, id: 'a', w: 100, x: 0, y: 0 }),
        rectangle({ h: 20, id: 'b', w: 20, x: 200, y: 0 }),
      ],
      { h: 100, w: 220, x: 0, y: 0 },
      'e',
      { x: 11, y: 0 },
      noModifiers
    );

    expect(next.get('b')?.w).toBe(MIN_SIZE);
  });
});

describe('rotating a selection', () => {
  it('reads a pointer angle with straight up as zero', () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: -100 })).toBe(0);
    expect(angleAt({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(90);
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 100 })).toBe(180);
    expect(angleAt({ x: 0, y: 0 }, { x: -100, y: 0 })).toBe(270);
  });

  it('snaps a rotation to fifteen degrees with shift', () => {
    expect(settleRotation(20, true)).toBe(15);
    expect(settleRotation(7, true)).toBe(0);
    expect(settleRotation(20, false)).toBe(20);
  });

  it('returns a rotation to zero when it lands near it', () => {
    expect(settleRotation(3, false)).toBe(0);
    expect(settleRotation(357, false)).toBe(0);
    expect(settleRotation(10, false)).toBe(10);
  });

  it('turns a shape about the selection centre', () => {
    const next = rotateSelection(
      [rectangle()],
      { x: 190, y: 150 },
      90,
      NO_GESTURE_MODIFIERS
    ).get('r');

    expect(next).toMatchObject({ rotation: 90, x: 80, y: 80 });
  });

  it('turns a group about the selection centre', () => {
    const next = rotateSelection(
      [
        rectangle({ h: 100, id: 'a', w: 100, x: 0, y: 0 }),
        rectangle({ h: 100, id: 'b', w: 100, x: 200, y: 0 }),
      ],
      { x: 150, y: 50 },
      180,
      NO_GESTURE_MODIFIERS
    );

    expect(next.get('a')).toMatchObject({ rotation: 180, x: 200, y: 0 });
  });
});
