import { CORNERS, FRAMES, SHAPES } from '@kiyora/dsl';
import { z } from 'zod';
import {
  fillStyleSchema,
  foregroundSchema,
  paletteColourSchema,
  themeSchema,
} from '../paint/palette';

/** The board's schema version. A migration bumps it. */
export const SCHEMA_VERSION = 1;

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
  w: z.number(),
  x: z.number(),
  y: z.number(),
});

/**
 * The figure kinds: every shape the grammar names, less the ones a dedicated
 * shape kind owns the semantics of. `sticky` is a note the sticky kind draws —
 * centred text, its own colour, grown to fit — so it is not a plain figure. The
 * grammar stays the one source, so the picker and the parser cannot disagree.
 */
export const figureKindSchema = z.enum(SHAPES).exclude(['sticky']);

/** A figure kind. */
export type FigureKind = z.infer<typeof figureKindSchema>;

/** The figure kinds, in the grammar's order, for a picker that shows them all. */
export const FIGURE_KINDS: readonly FigureKind[] = figureKindSchema.options;

const figureSchema = shapeBaseSchema.extend({ kind: figureKindSchema });

/** A figure: the shapes the vocabulary draws from a name. */
export type FigureShape = z.infer<typeof figureSchema>;

/**
 * The variants a frame carries. The device names are the grammar's, taken from
 * it rather than declared a second time, as ADR-0002 asks. `plain` is the frame
 * with no device chrome, which is what v1 draws until the device frames land in
 * v1.5.
 */
export const FRAME_VARIANTS = ['plain', ...FRAMES] as const;

/** A frame's variant: `plain`, or one of the device frames the grammar names. */
export const frameVariantSchema = z.enum(FRAME_VARIANTS);

/** A frame's variant. */
export type FrameVariant = z.infer<typeof frameVariantSchema>;

/**
 * A frame: a shape that holds other shapes and can clip them. Its box is
 * authored, so membership never rewrites it — that is what separates a frame
 * from a group, whose box is derived.
 */
export const frameSchema = shapeBaseSchema.extend({
  clip: z.boolean(),
  kind: z.literal('frame'),
  variant: frameVariantSchema,
});

/** A frame. */
export type FrameShape = z.infer<typeof frameSchema>;

/** One item on the board. Inside a frame or a group, `parentId` names it. */
export const shapeSchema = z.discriminatedUnion('kind', [
  figureSchema,
  frameSchema,
]);

/** One item on the board. */
export type Shape = z.infer<typeof shapeSchema>;

/** Where the board is being looked at from. Outside history, never in an artifact. */
export const cameraSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});

/** Where the board is being looked at from. */
export type Camera = z.infer<typeof cameraSchema>;

/** The board's settings, authored and saved with it. */
export const settingsSchema = z.object({
  theme: themeSchema,
});

/** The board's settings. */
export type BoardSettings = z.infer<typeof settingsSchema>;

/** One entry in the deck: a frame, its notes, and whether presenting skips it. */
export const slideSchema = z.object({
  frameId: z.string().min(1),
  notes: z.string(),
  skipped: z.boolean(),
});

/** One entry in the deck. */
export type Slide = z.infer<typeof slideSchema>;

/**
 * The document of record. `shapes` is the paint order, so there is no ordering
 * number, and everything derivable — boxes, paths, wrapping — is left out.
 */
export const boardSchema = z.object({
  camera: cameraSchema,
  createdAt: z.number().int().nonnegative(),
  deck: z.array(slideSchema),
  id: z.string().min(1),
  schemaVersion: z.literal(SCHEMA_VERSION),
  settings: settingsSchema,
  shapes: z.array(shapeSchema),
  title: z.string(),
  updatedAt: z.number().int().nonnegative(),
});

/** The document of record. */
export type Board = z.infer<typeof boardSchema>;
