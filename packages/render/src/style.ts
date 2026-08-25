import type { Color, Fill } from '@kiyora/dsl';

export const INK = '#1e1e1e';
export const WHITE = '#ffffff';

export type PaletteColor = Color | 'white';
export type ResolvedFill = 'pastel' | 'bold' | 'outline';
export type FillStyle = ResolvedFill | 'shadow';

/** The nine semantic palette colours accepted by Kiyora DSL. */
export const COLORS: readonly Color[] = [
	'blue',
	'green',
	'red',
	'orange',
	'violet',
	'teal',
	'pink',
	'yellow',
	'gray',
];

/** The fixed v1 palette. Outline is the saturated colour used as a stroke. */
export const PALETTE: Record<
	PaletteColor,
	{ bold: string; outline: string; pastel: string }
> = {
	blue: { bold: '#4dabf7', outline: '#4dabf7', pastel: '#a5d8ff' },
	gray: { bold: '#868e96', outline: '#868e96', pastel: '#e9ecef' },
	green: { bold: '#51cf66', outline: '#51cf66', pastel: '#b2f2bb' },
	orange: { bold: '#ff922b', outline: '#ff922b', pastel: '#ffd8a8' },
	pink: { bold: '#f06595', outline: '#f06595', pastel: '#fcc2d7' },
	red: { bold: '#ff6b6b', outline: '#ff6b6b', pastel: '#ffc9c9' },
	teal: { bold: '#20c997', outline: '#20c997', pastel: '#96f2d7' },
	violet: { bold: '#cc5de8', outline: '#cc5de8', pastel: '#eebefa' },
	white: { bold: '#ced4da', outline: INK, pastel: WHITE },
	yellow: { bold: '#ffd43b', outline: INK, pastel: '#ffec99' },
};

export const FONT_HAND = "'Balsamiq Sans Neue', cursive";
export const FONT_CODE = "'JetBrains Mono', ui-monospace, monospace";
export const NODE_STROKE = 2;
export const EDGE_STROKE = 2.5;
export const TEXT_PADDING = 6;
export const NODE_FONT_SIZE = 16;
export const EDGE_FONT_SIZE = 13;

export type Style = {
	fill: string;
	fillOpacity: number;
	shadow: boolean;
	stroke: string;
	text: string;
};

function lightness(value: string): number {
	const match = /^#([\da-f]{6})$/i.exec(value);
	if (!match) {
		return 1;
	}
	const [, hex] = match;
	if (!hex) {
		return 1;
	}
	const red = Number.parseInt(hex.slice(0, 2), 16);
	const green = Number.parseInt(hex.slice(2, 4), 16);
	const blue = Number.parseInt(hex.slice(4, 6), 16);
	return (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
}

/** Return ink for light fills and white for dark fills. */
export function textColorFor(fill: string): string {
	return fill === 'transparent' || lightness(fill) > 0.62 ? INK : WHITE;
}

function isPaletteColor(color: string): color is PaletteColor {
	return Object.hasOwn(PALETTE, color);
}

function paletteEntry(
	color: string
): { bold: string; outline: string; pastel: string } | undefined {
	return isPaletteColor(color) ? PALETTE[color] : undefined;
}

/** Resolve semantic node tokens into SVG-ready colours and effects. */
export function resolveStyle(
	color: Color | 'white' | string,
	fill: Fill | 'shadow' | ResolvedFill = 'pastel',
	stroke?: string
): Style {
	if (color === 'transparent') {
		return {
			fill: 'none',
			fillOpacity: 1,
			shadow: false,
			stroke: stroke ?? INK,
			text: INK,
		};
	}
	const entry = paletteEntry(color) ?? {
		bold: color,
		outline: color,
		pastel: color,
	};
	if (fill === 'outline') {
		const outline = stroke ?? entry.outline;
		return {
			fill: WHITE,
			fillOpacity: 1,
			shadow: false,
			stroke: outline,
			text: outline,
		};
	}
	const shadow = fill === 'shadow';
	const resolvedFill = fill === 'bold' || shadow ? entry.bold : entry.pastel;
	return {
		fill: resolvedFill,
		fillOpacity: 1,
		shadow,
		stroke: stroke ?? INK,
		text: textColorFor(resolvedFill),
	};
}

/** Radius used for rounded boxes; always bounded for small and large boxes. */
export function cornerRadius(width: number, height: number): number {
	return Math.min(12, Math.max(6, Math.round(Math.min(width, height) * 0.08)));
}

export function dashAttrs(
	dash: 'solid' | 'dashed' | 'dotted',
	width = EDGE_STROKE
): { strokeDasharray?: string; strokeLinecap: 'round' } {
	if (dash === 'dashed') {
		return {
			strokeDasharray: `${width * 1.8} ${width * 2.4}`,
			strokeLinecap: 'round',
		};
	}
	if (dash === 'dotted') {
		return { strokeDasharray: `0.01 ${width * 2}`, strokeLinecap: 'round' };
	}
	return { strokeLinecap: 'round' };
}

/** Resolve an edge colour to the saturated palette colour. */
export function edgeColor(color?: Color | 'white' | string): string {
	if (!color) {
		return INK;
	}
	return paletteEntry(color)?.bold ?? color;
}
