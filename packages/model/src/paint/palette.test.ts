import { COLORS, CORNERS, FILLS } from '@kiyora/dsl';
import {
  cornerSchema,
  DASHES,
  dashSchema,
  FOREGROUND,
  fillStyleSchema,
  PALETTE,
  paletteColourSchema,
} from '@kiyora/model';
import { describe, expect, it } from 'vitest';

const sorted = (values: readonly string[]): string[] => [...values].sort();

describe('the palette', () => {
  it('names exactly the grammar colours, so a colour added to either side fails here', () => {
    expect(sorted(paletteColourSchema.options)).toEqual(sorted(COLORS));
    expect(sorted(Object.keys(PALETTE))).toEqual(sorted(COLORS));
  });

  it('fills exactly the grammar fill styles, so a style added to either side fails here', () => {
    expect(sorted(fillStyleSchema.options)).toEqual(sorted(FILLS));
  });

  it('keeps the foreground outside the palette, so the grammar still names nine colours', () => {
    expect(sorted(COLORS)).not.toContain(FOREGROUND);
    expect(sorted(Object.keys(PALETTE))).not.toContain(FOREGROUND);
  });

  it('names exactly the grammar corners, so a corner added to either side fails here', () => {
    expect(sorted(cornerSchema.options)).toEqual(sorted(CORNERS));
  });

  it('offers the three stroke patterns a provisional stroke needs', () => {
    expect(sorted(dashSchema.options)).toEqual(sorted(DASHES));
    expect(sorted(DASHES)).toEqual(['dashed', 'dotted', 'solid']);
  });
});
