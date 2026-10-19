import { z } from 'zod';

/**
 * Text style: the four size presets, the horizontal alignment, and the vertical
 * alignment a shape label also carries. The stored field is a numeric size, so a
 * preset is a choice the UI offers rather than a second vocabulary the board
 * keeps.
 */

/** The four size presets, in ascending order. */
export const TEXT_SIZES = [12, 16, 24, 32] as const;

/** The preset names the inspector offers, each one numeric size. */
export const TEXT_SIZE_PRESETS = {
  large: 24,
  medium: 16,
  small: 12,
  xlarge: 32,
} as const;

/** The horizontal alignments a label may use. */
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;

/** The vertical alignments a shape label may use. */
export const TEXT_VALIGNS = ['top', 'middle', 'bottom'] as const;

/** How a label sits inside its shape. */
export const textStyleSchema = z.object({
  align: z.enum(TEXT_ALIGNS),
  size: z.number().positive(),
  valign: z.enum(TEXT_VALIGNS),
});

/** How a label sits inside its shape. */
export type TextStyle = z.infer<typeof textStyleSchema>;

/** The alignment of a label. */
export type TextAlign = (typeof TEXT_ALIGNS)[number];

/** The vertical alignment of a shape label. */
export type TextVerticalAlign = (typeof TEXT_VALIGNS)[number];

/** The style a label wears until the inspector changes it: centred in its shape. */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  align: 'center',
  size: TEXT_SIZE_PRESETS.medium,
  valign: 'middle',
};
