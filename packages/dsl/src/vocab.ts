/**
 * The Kiyora DSL vocabulary: shapes, palette colors, style tokens, and the
 * resolution helpers that map source tokens to canonical values.
 *
 * Resolution is case-insensitive and returns `null` for unknown tokens, so
 * callers can report an `unknown-shape` / `unknown-color` warning instead of
 * guessing. v1 accepts exactly these tokens; longhand and hex colors are
 * deliberately deferred.
 */

/** Canonical shape names (42). */
export const SHAPES = [
	'rectangle',
	'ellipse',
	'circle',
	'diamond',
	'cylinder',
	'queue',
	'callout',
	'hexagon',
	'parallelogram',
	'trapezoid',
	'triangle',
	'cloud',
	'star',
	'speech-bubble',
	'note',
	'sticky',
	'checkbox',
	'crossbox',
	'heart',
	'arrow-up',
	'arrow-down',
	'arrow-left',
	'arrow-right',
	'plus',
	'bolt',
	'document',
	'predefined-process',
	'manual-input',
	'pentagon',
	'chevron',
	'octagon',
	'cube',
	'actor',
	'double-circle',
	'card',
	'delay',
	'fork-join',
	'multi-document',
	'multi-process',
	'package',
	'component',
	'brace',
] as const;

export type Shape = (typeof SHAPES)[number];

/** Shape aliases accepted in source, mapped to their canonical shape. */
export const SHAPE_ALIASES: Record<string, Shape> = {
	activity: 'rectangle',
	box: 'rectangle',
	box3d: 'cube',
	cross: 'plus',
	crossedbox: 'crossbox',
	data: 'parallelogram',
	database: 'cylinder',
	db: 'cylinder',
	decision: 'diamond',
	doc: 'document',
	documents: 'multi-document',
	doublecircle: 'double-circle',
	end: 'ellipse',
	event: 'ellipse',
	fork: 'fork-join',
	gateway: 'diamond',
	io: 'parallelogram',
	join: 'fork-join',
	lightning: 'bolt',
	'notched-rectangle': 'card',
	'off-page': 'pentagon',
	offpage: 'pentagon',
	oval: 'ellipse',
	person: 'actor',
	prep: 'hexagon',
	preparation: 'hexagon',
	process: 'rectangle',
	processes: 'multi-process',
	ring: 'double-circle',
	'stacked-document': 'multi-document',
	'stacked-rectangle': 'multi-process',
	start: 'ellipse',
	stop: 'octagon',
	storage: 'cylinder',
	subroutine: 'predefined-process',
	terminator: 'ellipse',
} satisfies Record<string, Shape>;

/** The 9 v1 palette color tokens. */
export const COLORS = [
	'blue',
	'green',
	'red',
	'orange',
	'violet',
	'teal',
	'pink',
	'yellow',
	'gray',
] as const;

export type Color = (typeof COLORS)[number];

/** Palette color aliases accepted in source. */
export const COLOR_ALIASES: Record<string, Color> = {
	grey: 'gray',
	purple: 'violet',
};

/** Fill styles. */
export const FILLS = ['pastel', 'bold', 'outline'] as const;
export type Fill = (typeof FILLS)[number];

/** Corner styles. */
export const CORNERS = ['sharp', 'rounded'] as const;
export type Corner = (typeof CORNERS)[number];

const CORNER_ALIASES: Record<string, Corner> = {
	round: 'rounded',
	square: 'sharp',
};

/** Device / wireframe frames. */
export const FRAMES = ['browser', 'phone', 'window', 'tablet'] as const;
export type Frame = (typeof FRAMES)[number];

/** Arrow head styles. */
export const HEADS = ['arrow', 'circle', 'cross'] as const;
export type Head = (typeof HEADS)[number];

const HEAD_ALIASES: Record<string, Head> = {
	dot: 'circle',
	o: 'circle',
	x: 'cross',
};

/** Layout directions. */
export const DIRECTIONS = ['right', 'down', 'left', 'up'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * Resolve a shape token (canonical or alias) to a canonical shape, or `null`.
 */
export function resolveShape(token: string): Shape | null {
	const t = token.toLowerCase();
	return (SHAPES as readonly string[]).includes(t)
		? (t as Shape)
		: (SHAPE_ALIASES[t] ?? null);
}

/** Resolve a color token to a palette color, or `null`. */
export function resolveColor(token: string): Color | null {
	const t = token.trim().toLowerCase();
	return (COLORS as readonly string[]).includes(t)
		? (t as Color)
		: (COLOR_ALIASES[t] ?? null);
}

/** Resolve a fill token, or `null`. */
export function resolveFill(token: string): Fill | null {
	const t = token.toLowerCase();
	return (FILLS as readonly string[]).includes(t) ? (t as Fill) : null;
}

/** Resolve a corner token (canonical or alias), or `null`. */
export function resolveCorner(token: string): Corner | null {
	const t = token.toLowerCase();
	return (CORNERS as readonly string[]).includes(t)
		? (t as Corner)
		: (CORNER_ALIASES[t] ?? null);
}

/** Resolve a frame token, or `null`. */
export function resolveFrame(token: string): Frame | null {
	const t = token.toLowerCase();
	return (FRAMES as readonly string[]).includes(t) ? (t as Frame) : null;
}

/** Resolve an arrow-head token (canonical or alias), or `null`. */
export function resolveHead(token: string): Head | null {
	const t = token.toLowerCase();
	return (HEADS as readonly string[]).includes(t)
		? (t as Head)
		: (HEAD_ALIASES[t] ?? null);
}

/**
 * Turn a label into a stable id: lowercase, non-alphanumerics become single
 * hyphens, hyphens trimmed from both ends. Falls back to `"node"` when the
 * result is empty.
 */
export function slugify(text: string): string {
	const slug = text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'node';
}

/**
 * De-duplicate an id against a used set: `name`, `name-2`, `name-3`, …
 * The winning id is added to `used` before it is returned.
 */
export function uniqueId(base: string, used: Set<string>): string {
	let id = base;
	let n = 2;
	while (used.has(id)) {
		id = `${base}-${n}`;
		n += 1;
	}
	used.add(id);
	return id;
}
