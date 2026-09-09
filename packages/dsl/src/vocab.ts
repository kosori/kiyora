/**
 * The Kiyora DSL vocabulary: shapes, palette colors, style tokens, and the
 * resolution helpers that map source tokens to canonical values.
 *
 * Resolution is case-insensitive and returns `null` for unknown tokens, so
 * callers can report an `unknown-shape` / `unknown-color` warning instead of
 * guessing. Arbitrary hex codes and standard CSS color names snap to the
 * nearest Kiyora palette hue.
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
	'entity',
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

/**
 * Standard CSS color names mapped to hex codes (CSS Color Module Level 4).
 */
export const CSS_NAMED_COLORS: Record<string, string> = {
	aliceblue: '#f0f8ff',
	antiquewhite: '#faebd7',
	aqua: '#00ffff',
	aquamarine: '#7fffd4',
	azure: '#f0ffff',
	beige: '#f5f5dc',
	bisque: '#ffe4c4',
	black: '#000000',
	blanchedalmond: '#ffebcd',
	blue: '#0000ff',
	blueviolet: '#8a2be2',
	brown: '#a52a2a',
	burlywood: '#deb887',
	cadetblue: '#5f9ea0',
	chartreuse: '#7fff00',
	chocolate: '#d2691e',
	coral: '#ff7f50',
	cornflowerblue: '#6495ed',
	cornsilk: '#fff8dc',
	crimson: '#dc143c',
	cyan: '#00ffff',
	darkblue: '#00008b',
	darkcyan: '#008b8b',
	darkgoldenrod: '#b8860b',
	darkgray: '#a9a9a9',
	darkgreen: '#006400',
	darkgrey: '#a9a9a9',
	darkkhaki: '#bdb76b',
	darkmagenta: '#8b008b',
	darkolivegreen: '#556b2f',
	darkorange: '#ff8c00',
	darkorchid: '#9932cc',
	darkred: '#8b0000',
	darksalmon: '#e9967a',
	darkseagreen: '#8fbc8f',
	darkslateblue: '#483d8b',
	darkslategray: '#2f4f4f',
	darkslategrey: '#2f4f4f',
	darkturquoise: '#00ced1',
	darkviolet: '#9400d3',
	deeppink: '#ff1493',
	deepskyblue: '#00bfff',
	dimgray: '#696969',
	dimgrey: '#696969',
	dodgerblue: '#1e90ff',
	firebrick: '#b22222',
	floralwhite: '#fffaf0',
	forestgreen: '#228b22',
	fuchsia: '#ff00ff',
	gainsboro: '#dcdcdc',
	ghostwhite: '#f8f8ff',
	gold: '#ffd700',
	goldenrod: '#daa520',
	gray: '#808080',
	green: '#008000',
	greenyellow: '#adff2f',
	grey: '#808080',
	honeydew: '#f0fff0',
	hotpink: '#ff69b4',
	indianred: '#cd5c5c',
	indigo: '#4b0082',
	ivory: '#fffff0',
	khaki: '#f0e68c',
	lavender: '#e6e6fa',
	lavenderblush: '#fff0f5',
	lawngreen: '#7cfc00',
	lemonchiffon: '#fffacd',
	lightblue: '#add8e6',
	lightcoral: '#f08080',
	lightcyan: '#e0ffff',
	lightgoldenrodyellow: '#fafad2',
	lightgray: '#d3d3d3',
	lightgreen: '#90ee90',
	lightgrey: '#d3d3d3',
	lightpink: '#ffb6c1',
	lightsalmon: '#ffa07a',
	lightseagreen: '#20b2aa',
	lightskyblue: '#87cefa',
	lightslategray: '#778899',
	lightslategrey: '#778899',
	lightsteelblue: '#b0c4de',
	lightyellow: '#ffffe0',
	lime: '#00ff00',
	limegreen: '#32cd32',
	linen: '#faf0e6',
	magenta: '#ff00ff',
	maroon: '#800000',
	mediumaquamarine: '#66cdaa',
	mediumblue: '#0000cd',
	mediumorchid: '#ba55d3',
	mediumpurple: '#9370db',
	mediumseagreen: '#3cb371',
	mediumslateblue: '#7b68ee',
	mediumspringgreen: '#00fa9a',
	mediumturquoise: '#48d1cc',
	mediumvioletred: '#c71585',
	midnightblue: '#191970',
	mintcream: '#f5fffa',
	mistyrose: '#ffe4e1',
	moccasin: '#ffe4e5',
	navajowhite: '#ffdead',
	navy: '#000080',
	oldlace: '#fdf5e6',
	olive: '#808000',
	olivedrab: '#6b8e23',
	orange: '#ffa500',
	orangered: '#ff4500',
	orchid: '#da70d6',
	palegoldenrod: '#eee8aa',
	palegreen: '#98fb98',
	paleturquoise: '#afeeee',
	palevioletred: '#db7093',
	papayawhip: '#ffefd5',
	peachpuff: '#ffdab9',
	peru: '#cd853f',
	pink: '#ffc0cb',
	plum: '#dda0dd',
	powderblue: '#b0e0e6',
	purple: '#800080',
	rebeccapurple: '#663399',
	red: '#ff0000',
	rosybrown: '#bc8f8f',
	royalblue: '#4169e1',
	saddlebrown: '#8b4513',
	salmon: '#fa8072',
	sandybrown: '#f4a460',
	seagreen: '#2e8b57',
	seashell: '#fff5ee',
	sienna: '#a0522d',
	silver: '#c0c0c0',
	skyblue: '#87ceeb',
	slateblue: '#6a5acd',
	slategray: '#708090',
	slategrey: '#708090',
	snow: '#fffafa',
	springgreen: '#00ff7f',
	steelblue: '#4682b4',
	tan: '#d2b48c',
	teal: '#008080',
	thistle: '#d8bfd8',
	tomato: '#ff6347',
	turquoise: '#40e0d0',
	violet: '#ee82ee',
	wheat: '#f5deb3',
	white: '#ffffff',
	whitesmoke: '#f5f5f5',
	yellow: '#ffff00',
	yellowgreen: '#9acd32',
};

/**
 * Anchor hue angles for chromatic Kiyora palette colors on the HSL circle (0-360).
 */
const PALETTE_HUES: readonly (readonly [Color, number])[] = [
	['red', 0],
	['orange', 30],
	['yellow', 60],
	['green', 120],
	['teal', 170],
	['blue', 215],
	['violet', 280],
	['pink', 330],
];

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
export const HEADS = [
	'arrow',
	'circle',
	'cross',
	'none',
	'crow-one',
	'crow-many',
	'crow-one-or-many',
	'crow-zero-or-one',
	'uml-generalization',
	'uml-composition',
	'uml-aggregation',
] as const;
export type Head = (typeof HEADS)[number];

const HEAD_ALIASES: Record<string, Head> = {
	dot: 'circle',
	o: 'circle',
	x: 'cross',
};

/**
 * Edge connector tokens, longest first so scanning prefers `<-.-` over `<-`.
 * Solid: `->`; dashed: `-->`, `<--`; dotted: `-.->`, `..>`, `<-.-`, `<..`;
 * bidirectional: `<->`, `<-->`, `<..>`, `<-.->`; reverse: `<-`, `<--`, `<..`;
 * plus the bare `>`/`<` shorthand and `<>`.
 */
export const ARROWS = [
	'<-.->',
	'<-->',
	'<..>',
	'-.->',
	'<-.-',
	'<->',
	'-->',
	'<--',
	'<..',
	'..>',
	'<-',
	'->',
	'<>',
	'>',
	'<',
] as const;

export const CROWS: Record<
	string,
	{ from?: string; to?: string; identifying?: boolean }
> = {
	'..': { identifying: false },
	'}|--|{': { from: 'one-or-many', to: 'one-or-many' },
	'}|--||': { from: 'one-or-many', to: 'one' },
	'}|--o{': { from: 'one-or-many', to: 'many' },
	'}|--o|': { from: 'one-or-many', to: 'zero-or-one' },
	'}o--|{': { from: 'many', to: 'one-or-many' },
	'}o--||': { from: 'many', to: 'one' },
	'}o--o{': { from: 'many', to: 'many' },
	'}o--o|': { from: 'many', to: 'zero-or-one' },
	'||--|{': { from: 'one', to: 'one-or-many' },
	'||--||': { from: 'one', to: 'one' },
	'||--o{': { from: 'one', to: 'many' },
	'||--o|': { from: 'one', to: 'zero-or-one' },
	'|o--|{': { from: 'zero-or-one', to: 'one-or-many' },
	'|o--||': { from: 'zero-or-one', to: 'one' },
	'|o--o{': { from: 'zero-or-one', to: 'many' },
	'|o--o|': { from: 'zero-or-one', to: 'zero-or-one' },
};

export const UML_RELATIONS: Record<string, { kind: string; swap?: boolean }> = {
	'--': { kind: 'association' },
	'--*': { kind: 'composition', swap: true },
	'-->': { kind: 'association', swap: true },
	'--|>': { kind: 'generalization', swap: true },
	'--o': { kind: 'aggregation', swap: true },
	'..>': { kind: 'dependency', swap: true },
	'..|>': { kind: 'realization', swap: true },
	'*--': { kind: 'composition' },
	'<--': { kind: 'association' },
	'<-->': { kind: 'association' },
	'<..': { kind: 'dependency' },
	'<|--': { kind: 'generalization' },
	'<|..': { kind: 'realization' },
	'o--': { kind: 'aggregation' },
};

export const CARDINALITY: Record<string, { value: string; swap?: boolean }> = {
	'*': { value: '*' },
	'0..1': { value: '0..1' },
	'1': { value: '1' },
	'1..*': { value: '1..*' },
	m: { value: 'm' },
	n: { value: 'n' },
};

export const CLASS_ARROWS = [
	...Object.keys(CROWS),
	...Object.keys(UML_RELATIONS),
	...ARROWS,
];

/** Arrow token classifiers: dotted/dashed style, reverse, bidirectional. */
export const isDotted = (t: string): boolean =>
	t.includes('.') || t.includes('--');
export const isBack = (t: string): boolean =>
	t === '<-' || t === '<..' || t === '<--' || t === '<-.-' || t === '<';
export const isBidirectional = (t: string): boolean =>
	t === '<->' || t === '<..>' || t === '<-->' || t === '<-.->' || t === '<>';

/** Layout directions. */
export const DIRECTIONS = ['right', 'down', 'left', 'up'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * Graph-family header keywords → canonical family (reference `FAMILIES`
 * map). The header must be the whole first non-empty line; a line like
 * `flowchart Cache` stays a node statement (reference-faithful).
 */
export const FAMILIES: Record<string, string> = {
	architecture: 'architecture',
	bpmn: 'bpmn',
	class: 'class',
	erd: 'class',
	flow: 'flowchart',
	flowchart: 'flowchart',
	fsm: 'statemachine',
	graph: 'architecture',
	mindmap: 'mindmap',
	org: 'orgchart',
	orgchart: 'orgchart',
	state: 'statemachine',
	statemachine: 'statemachine',
	uml: 'class',
};

/** Non-graph family headers recognized so they can be refused with an
 * `unsupported-family` error instead of being misparsed as a graph. */
export const STANDALONE_FAMILIES = [
	'gitgraph',
	'gantt',
	'sankey',
	'infographic',
	'chart',
] as const;

/** Unsupported graph-family keywords → refused with `unsupported-family`. */
export const UNSUPPORTED_GRAPH_FAMILIES = ['wireframe'] as const;

/** The five v1 graph-family variants. */
export type Family =
	| 'architecture'
	| 'bpmn'
	| 'flowchart'
	| 'orgchart'
	| 'statemachine';

/**
 * Resolve a shape token (canonical or alias) to a canonical shape, or `null`.
 */
export function resolveShape(token: string): Shape | null {
	const t = token.toLowerCase();
	return (SHAPES as readonly string[]).includes(t)
		? (t as Shape)
		: (SHAPE_ALIASES[t] ?? null);
}

/**
 * Parse a 3-, 4-, 6-, or 8-digit hex code to normalized sRGB components [0, 1].
 */
function parseHex(hex: string): { b: number; g: number; r: number } | null {
	const match = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(hex.trim());
	if (!match) {
		return null;
	}
	const [, raw] = match;
	if (!raw) {
		return null;
	}
	if (raw.length === 3 || raw.length === 4) {
		const [rChar, gChar, bChar] = raw;
		if (!(rChar && gChar && bChar)) {
			return null;
		}
		const r = Number.parseInt(`${rChar}${rChar}`, 16) / 255;
		const g = Number.parseInt(`${gChar}${gChar}`, 16) / 255;
		const b = Number.parseInt(`${bChar}${bChar}`, 16) / 255;
		return { b, g, r };
	}
	const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
	const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
	const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
	return { b, g, r };
}

/**
 * Compute the HSL hue angle (0-360) from normalized sRGB components and delta.
 */
function hueFromRgb(
	r: number,
	g: number,
	b: number,
	max: number,
	delta: number
): number {
	if (delta === 0) {
		return 0;
	}
	let hue: number;
	if (max === r) {
		hue = ((g - b) / delta) % 6;
	} else if (max === g) {
		hue = (b - r) / delta + 2;
	} else {
		hue = (r - g) / delta + 4;
	}
	hue = Math.round(hue * 60);
	if (hue < 0) {
		hue += 360;
	}
	return hue % 360;
}

type ColorMetrics = { delta: number; hue: number };

function hexColorMetrics(hex: string): ColorMetrics | null {
	const rgb = parseHex(hex);
	if (!rgb) {
		return null;
	}
	const max = Math.max(rgb.r, rgb.g, rgb.b);
	const min = Math.min(rgb.r, rgb.g, rgb.b);
	const delta = max - min;
	return { delta, hue: hueFromRgb(rgb.r, rgb.g, rgb.b, max, delta) };
}

/**
 * Extract the HSL hue angle (0-360) from a hex code, or null if the string is
 * not a valid hex color code.
 */
export function extractHue(hex: string): number | null {
	return hexColorMetrics(hex)?.hue ?? null;
}

/**
 * Snap an HSL hue angle (0-360) to the nearest allowed Kiyora palette color.
 */
export function snapHue(hue: number): Color {
	const normalized = ((hue % 360) + 360) % 360;
	let closestColor: Color = 'red';
	let minDistance = 360;

	for (const [color, targetHue] of PALETTE_HUES) {
		const diff = Math.abs(normalized - targetHue) % 360;
		const distance = diff > 180 ? 360 - diff : diff;
		if (distance < minDistance) {
			minDistance = distance;
			closestColor = color;
		}
	}

	return closestColor;
}

/**
 * Resolve a color token, standard CSS color name, or hex string to a canonical
 * palette color, or `null`. Hex and CSS colors are safely snapped to the nearest
 * Kiyora palette hue.
 */
export function resolveColor(token: string): Color | null {
	const t = token.trim().toLowerCase();
	if (!t) {
		return null;
	}
	if ((COLORS as readonly string[]).includes(t)) {
		return t as Color;
	}
	const alias = COLOR_ALIASES[t];
	if (alias) {
		return alias;
	}
	const hex = CSS_NAMED_COLORS[t] ?? t;
	const metrics = hexColorMetrics(hex);
	if (!metrics) {
		return null;
	}
	if (metrics.delta === 0) {
		return 'gray';
	}
	return snapHue(metrics.hue);
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
