import { CORNERS, FRAMES, HEADS, SHAPES } from '@kiyora/dsl';
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

const textSchema = shapeBaseSchema.extend({ kind: z.literal('text') });

/** A text shape: words that belong to nothing else. */
export type TextShape = z.infer<typeof textSchema>;

/**
 * The four sides an anchor can name on a shape, in drawing order. There is no
 * grammar token for a side, so the vocabulary is the schema's, kept small and
 * the only one a connector's binding can use.
 */
export const EDGES = ['top', 'right', 'bottom', 'left'] as const;

/** A side of a shape. */
export const edgeSchema = z.enum(EDGES);

/** A side of a shape. */
export type Edge = z.infer<typeof edgeSchema>;

/**
 * Where on a shape a connector attaches: an edge and a fraction along it, from
 * 0 to 1. An endpoint may name one to fix a connection to a specific edge, and
 * omits it when the author does not care — the walker then chooses one that
 * faces the other end. Fractions are clamped when they resolve, so a stale one
 * can never place an anchor off its shape.
 */
export const anchorSchema = z.object({
  edge: edgeSchema,
  fraction: z.number().min(0).max(1),
});

/** Where on a shape a connector attaches. */
export type Anchor = z.infer<typeof anchorSchema>;

/**
 * One end of a connector: bound to a shape — with an anchor the author named,
 * or none, so the walker picks one — or free at a coordinate. A free end is how
 * a connector is drawn before its target exists, so the two ends never have to
 * be created in the same order.
 */
export const endpointSchema = z.discriminatedUnion('kind', [
  z.object({
    anchor: anchorSchema.optional(),
    kind: z.literal('bound'),
    shapeId: z.string().min(1),
  }),
  z.object({ kind: z.literal('free'), x: z.number(), y: z.number() }),
]);

/** One end of a connector. */
export type Endpoint = z.infer<typeof endpointSchema>;

/** How a connector's line travels between its ends. */
export const ROUTES = ['straight', 'curved', 'elbow'] as const;

/** How a connector's line travels. */
export const routeSchema = z.enum(ROUTES);

/** How a connector's line travels. */
export type Route = z.infer<typeof routeSchema>;

/**
 * The head a connector wears at one end, taken from the grammar's own list so
 * the inspector and the parser cannot disagree about what an arrowhead is. A
 * head is per end: `start` and `end` are chosen independently.
 */
export const headSchema = z.enum(HEADS);

/** The head a connector wears at one end. */
export type Head = z.infer<typeof headSchema>;

/**
 * A connector: a shape that draws a line between two endpoints and stays
 * joined to the shapes they name. `x`, `y`, `w` and `h` come from the shape
 * base, but they are not the connector's geometry: the path is derived from the
 * endpoints on every paint, which is what lets a bound end follow its shape
 * with no repair pass. The box is the connector's authored footprint, used as
 * the fallback line when a bound target cannot be found.
 */
export const connectorSchema = shapeBaseSchema.extend({
  end: headSchema,
  from: endpointSchema,
  kind: z.literal('connector'),
  route: routeSchema,
  start: headSchema,
  to: endpointSchema,
});

/** A connector. */
export type ConnectorShape = z.infer<typeof connectorSchema>;

/** One item on the board. Inside a frame or a group, `parentId` names it. */
export const shapeSchema = z.discriminatedUnion('kind', [
  figureSchema,
  frameSchema,
  textSchema,
  connectorSchema,
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
