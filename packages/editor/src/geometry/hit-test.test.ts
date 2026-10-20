import { containsPoint, shapeAt, toScreen, toWorld } from '@kiyora/editor';
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
  h: 60,
  id: 'rectangle-1',
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

describe('hit-testing a painted shape', () => {
  it('finds a point inside the shape and misses one outside it', () => {
    const shape = rectangle({ h: 60, w: 100, x: 0, y: 0 });

    expect(containsPoint(shape, { x: 50, y: 30 })).toBe(true);
    expect(containsPoint(shape, { x: -1, y: 30 })).toBe(false);
    expect(containsPoint(shape, { x: 50, y: 61 })).toBe(false);
  });

  it('follows the shape off its axis, so a turned shape is picked where it is drawn', () => {
    const turned = rectangle({ h: 20, rotation: 90, w: 100, x: 0, y: 0 });

    expect(containsPoint(turned, { x: 50, y: 40 })).toBe(true);
    expect(containsPoint(turned, { x: 90, y: 10 })).toBe(false);
  });

  it('picks the topmost shape, because the last one painted is the one in front', () => {
    const under = rectangle({ id: 'under', x: 0, y: 0 });
    const over = rectangle({ id: 'over', x: 20, y: 20 });

    expect(shapeAt([under, over], { x: 50, y: 50 })?.id).toBe('over');
  });

  it('picks nothing in empty space', () => {
    expect(shapeAt([rectangle()], { x: 500, y: 500 })).toBeNull();
  });

  it('leaves a locked shape unpickable, so a lock means a lock', () => {
    expect(shapeAt([rectangle({ locked: true })], { x: 50, y: 30 })).toBeNull();
  });

  it('agrees with the camera, so a click lands where the shape appears', () => {
    const camera = { x: 120, y: -40, zoom: 1.6 };
    const shape = rectangle({ id: 'shape-1', x: 100, y: 100 });
    const onScreen = toScreen(camera, { x: 120, y: 120 });
    const picked = shapeAt([shape], toWorld(camera, onScreen));

    expect(picked?.id).toBe('shape-1');
  });
});
