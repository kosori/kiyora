import { FRAMES, HEADS, SHAPES } from '@kiyora/dsl';
import { z } from 'zod';
import { themeSchema } from '../paint/palette';
import { filesSchema } from './image';
import { shapeBaseSchema } from './shape-base';

/** The board's schema version. A migration bumps it. */
export const SCHEMA_VERSION = 3;

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
 * The diagram code a frame was generated from. The AST is derived at apply time
 * and never stored, so the source is only the text a person typed, the ids it
 * last stamped, and whether a hand edit has since made those shapes stale.
 * Optional: a frame from before the panel existed carries none, and absence is
 * what an empty panel reads.
 */
export const sourceSchema = z.object({
  generatedIds: z.array(z.string().min(1)),
  stale: z.boolean(),
  text: z.string(),
});

/** The diagram code a frame was generated from. */
export type Source = z.infer<typeof sourceSchema>;

/**
 * A frame: a shape that holds other shapes and can clip them. Its box is
 * authored, so membership never rewrites it — that is what separates a frame
 * from a group, whose box is derived.
 */
export const frameSchema = shapeBaseSchema.extend({
  clip: z.boolean(),
  kind: z.literal('frame'),
  source: sourceSchema.optional(),
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

/**
 * The two ways a note's height is decided: `auto` follows the label it carries,
 * and `fixed` is the size a person chose when they resized it. A note saved
 * before the flag existed reads as `auto`, so an old board still fits its words.
 */
export const STICKY_FITS = ['auto', 'fixed'] as const;

/** How a sticky's height is decided. */
export const stickyFitSchema = z.enum(STICKY_FITS);

/** How a sticky's height is decided. */
export type StickyFit = z.infer<typeof stickyFitSchema>;

/**
 * A sticky: a coloured note with centred text whose height follows its content
 * until a person resizes it. It carries the flag that says which of those two
 * the authored height is, so the fit is legible rather than a guess from a
 * remembered size — its note colour is its style. It is a shape kind, not a
 * figure.
 */
const stickySchema = shapeBaseSchema.extend({
  fit: stickyFitSchema.default('auto'),
  kind: z.literal('sticky'),
});

/** A sticky: a coloured note whose height follows its label until resized. */
export type StickyShape = z.infer<typeof stickySchema>;

/**
 * A group: a shape that holds other shapes so they move together. It paints no
 * ink of its own, and its box is derived from its members rather than read from
 * the base box the schema requires. That stored box is a documented stand-in:
 * the app writes zeros when the group is made and never reads or rewrites it,
 * so a drag can never leave a stale box behind.
 */
export const groupSchema = shapeBaseSchema.extend({
  kind: z.literal('group'),
});

/** A group: shapes that move together, with no ink of their own. */
export type GroupShape = z.infer<typeof groupSchema>;

/**
 * An icon: a shape that draws one figure from the shipped icon dataset. It
 * carries only the icon's name, never its paths — the paths are generated,
 * committed and fetched on demand, so a board stays small and the dataset stays
 * out of the first paint. A name this build does not know paints its authored
 * box rather than throwing, so an older or newer file still opens.
 */
export const iconSchema = shapeBaseSchema.extend({
  kind: z.literal('icon'),
  name: z.string().min(1),
});

/** An icon: a named figure from the shipped dataset, drawn in its box. */
export type IconShape = z.infer<typeof iconSchema>;

/**
 * An image: a raster the board file carries, drawn in its authored box. It names
 * one entry in the board's `files` map rather than copying the bytes, so placing
 * the same picture twice costs one payload and resizing it costs nothing. A
 * `fileId` this build cannot find paints the authored box, so a file opened
 * without its payload is a legible placeholder rather than an empty hole.
 */
export const imageSchema = shapeBaseSchema.extend({
  fileId: z.string().min(1),
  kind: z.literal('image'),
});

/** An image: a raster from the board's files, drawn in its box. */
export type ImageShape = z.infer<typeof imageSchema>;

/**
 * The two ways freehand ink is drawn: a pen lays opaque ink, and a highlighter
 * lays a wider translucent band that paints behind its siblings so the words it
 * crosses stay legible.
 */
export const INK_MODES = ['pen', 'highlighter'] as const;

/** How freehand ink is drawn. */
export const inkModeSchema = z.enum(INK_MODES);

/** How freehand ink is drawn. */
export type InkMode = z.infer<typeof inkModeSchema>;

/**
 * One point on an ink stroke, as a fraction of the shape's authored box, with
 * the pressure the device reported while it was drawn. Pressure is absent when
 * the device reports none — a mouse always reports half a press, which is not a
 * pressure — so an even stroke is stored honestly rather than invented from a
 * constant. Fractions keep the stroke attached to its box through a move, a
 * resize and a rotation, exactly as they would any other authored geometry.
 */
export const inkPointSchema = z.object({
  pressure: z.number().min(0).max(1).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

/** One point on an ink stroke. */
export type InkPoint = z.infer<typeof inkPointSchema>;

/**
 * Freehand ink: a path of authored points with a colour, a width and a mode.
 * The box is derived from the points when the stroke is made and scales with
 * them afterwards, so the shape stays one thing a person can select, move,
 * resize, lock and export.
 */
export const inkSchema = shapeBaseSchema.extend({
  kind: z.literal('ink'),
  mode: inkModeSchema,
  points: z.array(inkPointSchema).min(1),
});

/** Freehand ink: a pen stroke or a highlighter band. */
export type InkShape = z.infer<typeof inkSchema>;

/** One item on the board. Inside a frame or a group, `parentId` names it. */
export const shapeSchema = z.discriminatedUnion('kind', [
  figureSchema,
  frameSchema,
  textSchema,
  connectorSchema,
  stickySchema,
  groupSchema,
  iconSchema,
  imageSchema,
  inkSchema,
]);

/** One item on the board. */
export type Shape = z.infer<typeof shapeSchema>;

/**
 * Where the board is being looked at from. The live value is the view's; the
 * board stores the snapshot the last save wrote, and no artifact draws it.
 */
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
  files: filesSchema.default({}),
  id: z.string().min(1),
  schemaVersion: z.literal(SCHEMA_VERSION),
  settings: settingsSchema,
  shapes: z.array(shapeSchema),
  title: z.string(),
  updatedAt: z.number().int().nonnegative(),
});

/** The document of record. */
export type Board = z.infer<typeof boardSchema>;
