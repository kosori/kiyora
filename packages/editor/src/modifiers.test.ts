import { gestureModifiers } from '@kiyora/editor';
import { describe, expect, it } from 'vitest';

describe('the gesture modifiers', () => {
  it('reads alt as the snap bypass and shift as the constraint', () => {
    expect(gestureModifiers({ altKey: true, shiftKey: false })).toEqual({
      bypassSnap: true,
      constrain: false,
    });
    expect(gestureModifiers({ altKey: false, shiftKey: true })).toEqual({
      bypassSnap: false,
      constrain: true,
    });
    expect(gestureModifiers({ altKey: false, shiftKey: false })).toEqual({
      bypassSnap: false,
      constrain: false,
    });
  });

  it('reads both at once, so a shift-held off-grid drag reads as one value', () => {
    expect(gestureModifiers({ altKey: true, shiftKey: true })).toEqual({
      bypassSnap: true,
      constrain: true,
    });
  });
});
