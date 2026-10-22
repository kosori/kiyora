import { CORNERS } from '@kiyora/dsl';
import { z } from 'zod';
import {
  fillStyleSchema,
  foregroundSchema,
  paletteColourSchema,
} from '../paint/palette';
import { textStyleSchema } from '../text/style';

/** How a shape's corners are drawn, taken from the grammar. */
export const cornerSchema = z.enum(CORNERS);

/** How a shape's corners are drawn. */
export type Corner = z.infer<typeof cornerSchema>;

/**
 * The stroke patterns a shape can wear. The grammar names the dashed and dotted
 * connector routes but no shape stroke, so the palette of patterns lives here —
 * a token, not a dash array, so only the pattern is authored and the walker
 * derives the numbers a renderer draws.
 */
export const DASHES = ['solid', 'dashed', 'dotted'] as const;

/** A stroke pattern: an unbroken, dashed or dotted outline. */
export const dashSchema = z.enum(DASHES);

/** A stroke pattern. */
export type Dash = z.infer<typeof dashSchema>;

/**
 * How a shape's outline and interior are styled, resolved from the palette.
 * Corner and dash default, so a board saved before they existed still reads:
 * the version 0 to 1 migration only has to stamp the version marker.
 */
export const styleSchema = z.object({
  corner: cornerSchema.default('sharp'),
  dash: dashSchema.default('solid'),
  fill: paletteColourSchema,
  fillStyle: fillStyleSchema,
  stroke: z.union([paletteColourSchema, foregroundSchema]),
  strokeWidth: z.number().nonnegative(),
});

/** How a shape's outline and interior are styled. */
export type Style = z.infer<typeof styleSchema>;

/** What a shape is, and where it sits, whatever it draws. */
export const shapeBaseSchema = z.object({
  h: z.number(),
  id: z.string().min(1),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  parentId: z.string().min(1).nullable(),
  rotation: z.number(),
  style: styleSchema,
  text: z.string().optional(),
  textStyle: textStyleSchema.optional(),
  w: z.number(),
  x: z.number(),
  y: z.number(),
});
