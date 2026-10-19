import { SHAPES } from '@kiyora/dsl';
import { z } from 'zod';
import {
  fillStyleSchema,
  foregroundSchema,
  paletteColourSchema,
  themeSchema,
} from '../paint/palette';
import { textStyleSchema } from '../text/style';

/** The board's schema version. A migration bumps it. */
export const SCHEMA_VERSION = 1;

/** How a shape's outline and interior are styled, resolved from the palette. */
export const styleSchema = z.object({
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

const textSchema = shapeBaseSchema.extend({ kind: z.literal('text') });

/** A text shape: words that belong to nothing else. */
export type TextShape = z.infer<typeof textSchema>;

/** One item on the board. Inside a frame or a group, `parentId` names it. */
export const shapeSchema = z.discriminatedUnion('kind', [
  figureSchema,
  textSchema,
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
