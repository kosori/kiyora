import { GRID, snapTranslation } from '@kiyora/editor';
import { describe, expect, it } from 'vitest';

describe('snapping to the grid', () => {
  it('steps by eight board units', () => {
    expect(GRID).toBe(8);
  });

  it('rounds a translation so the selection lands on the grid', () => {
    expect(snapTranslation(3, 80)).toBe(0);
    expect(snapTranslation(5, 80)).toBe(8);
  });

  it('pulls an off-grid origin onto the grid on the first move', () => {
    expect(snapTranslation(0, 83)).toBe(-3);
  });
});
