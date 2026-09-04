import type { Corner } from '@kiyora/dsl';
import { cornerRadius, INK, type Style } from './style';
import { type DrawableContour, sampleRoundedRect } from './wobble';

/** A rectangle used as the coordinate space for shape geometry. */
export type Box = { height: number; width: number; x: number; y: number };
export type ShapeKind = string;

/** One drawable component of a shape: its clean markup plus the structured
 * contour needed to render the wobble overlay without parsing SVG output.
 * Components without a contour are rendered clean only. */
export type ShapeComponent = {
	clean: string;
	contour?: DrawableContour;
};

/** Canonical shapes that intentionally use the rounded-rectangle fallback. */
export const FALLBACK_SHAPES = [
	'queue',
	'fork-join',
	'package',
	'component',
	'brace',
	'chevron',
	'pentagon',
	'octagon',
	'trapezoid',
	'multi-document',
	'multi-process',
	'manual-input',
	'arrow-up',
	'arrow-down',
	'arrow-left',
	'arrow-right',
	'cube',
] as const;

function roundedRectPath(
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
): string {
	const r = Math.min(radius, width / 2, height / 2);
	return [
		`M ${x + r} ${y}`,
		`H ${x + width - r}`,
		`A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
		`V ${y + height - r}`,
		`A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
		`H ${x + r}`,
		`A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
		`V ${y + r}`,
		`A ${r} ${r} 0 0 1 ${x + r} ${y}`,
		'Z',
	].join(' ');
}

function polygonPath(points: readonly [number, number][]): string {
	return `M ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
}

function attrs(style: Style, width: number): string {
	return `fill="${style.fill}" fill-opacity="${style.fillOpacity}" stroke="${style.stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
}

function path(d: string, style: Style, width: number): string {
	return `<path d="${d}" ${attrs(style, width)}/>`;
}

function circle(
	cx: number,
	cy: number,
	radius: number,
	style: Style,
	width: number
): string {
	return `<circle cx="${cx}" cy="${cy}" r="${radius}" ${attrs(style, width)}/>`;
}

function ellipse(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	style: Style,
	width: number
): string {
	return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${attrs(style, width)}/>`;
}

function cloudPath(box: Box): string {
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	const rx = box.width / 2;
	const ry = box.height / 2;
	return [
		`M ${cx - rx * 0.5} ${cy}`,
		`a ${rx * 0.28} ${ry * 0.28} 0 0 1 0 ${-ry * 0.45}`,
		`a ${rx * 0.35} ${ry * 0.35} 0 0 1 ${rx * 0.75} ${-ry * 0.1}`,
		`a ${rx * 0.35} ${ry * 0.35} 0 0 1 ${rx * 0.6} ${ry * 0.55}`,
		`a ${rx * 0.22} ${ry * 0.22} 0 0 1 0 ${ry * 0.5}`,
		`a ${rx * 0.3} ${ry * 0.3} 0 0 1 ${-rx * 0.8} ${ry * 0.05}`,
		`a ${rx * 0.28} ${ry * 0.28} 0 0 1 ${-rx * 0.55} ${-ry * 0.55}`,
		'Z',
	].join(' ');
}

function heartPath(box: Box): string {
	const cx = box.x + box.width / 2;
	const bottom = box.y + box.height;
	const { x, y, width, height } = box;
	return [
		`M ${cx} ${bottom}`,
		`C ${x - width * 0.05} ${y + height * 0.62}, ${x} ${y + height * 0.28}, ${x + width * 0.25} ${y + height * 0.28}`,
		`C ${x + width * 0.45} ${y + height * 0.28}, ${cx} ${y + height * 0.55}, ${cx} ${y + height * 0.45}`,
		`C ${cx} ${y + height * 0.55}, ${x + width * 0.55} ${y + height * 0.28}, ${x + width * 0.75} ${y + height * 0.28}`,
		`C ${x + width} ${y + height * 0.28}, ${x + width * 1.05} ${y + height * 0.62}, ${cx} ${bottom}`,
		'Z',
	].join(' ');
}

function documentPath(box: Box, radius: number): string {
	const wave = box.height * 0.18;
	const { x, y, width, height } = box;
	return [
		`M ${x + radius} ${y}`,
		`H ${x + width - radius}`,
		`A ${radius} ${radius} 0 0 1 ${x + width} ${y + radius}`,
		`V ${y + height - wave}`,
		`C ${x + width * 0.75} ${y + height}, ${x + width * 0.5} ${y + height - wave * 0.6}, ${x + width * 0.25} ${y + height}`,
		`C ${x + width * 0.12} ${y + height - wave * 0.4}, ${x} ${y + height - wave}, ${x} ${y + height - wave}`,
		`V ${y + radius}`,
		`A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
		'Z',
	].join(' ');
}

function notePath(box: Box, radius: number): string {
	const fold = Math.min(16, box.width * 0.2, box.height * 0.3);
	const { x, y, width, height } = box;
	return [
		`M ${x + radius} ${y}`,
		`H ${x + width - fold}`,
		`L ${x + width} ${y + fold}`,
		`V ${y + height - radius}`,
		`A ${radius} ${radius} 0 0 1 ${x + width - radius} ${y + height}`,
		`H ${x + radius}`,
		`A ${radius} ${radius} 0 0 1 ${x} ${y + height - radius}`,
		`V ${y + radius}`,
		`A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
		'Z',
	].join(' ');
}

function starPoints(
	cx: number,
	cy: number,
	outer: number,
	inner: number
): [number, number][] {
	const points: [number, number][] = [];
	for (let index = 0; index < 10; index += 1) {
		const radius = index % 2 === 0 ? outer : inner;
		const angle = -Math.PI / 2 + (index * Math.PI) / 5;
		points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
	}
	return points;
}

function propertyIs(
	value: object,
	key: string,
	predicate: (property: unknown) => boolean
): boolean {
	return predicate(Object.getOwnPropertyDescriptor(value, key)?.value);
}

function isBox(value: unknown): value is Box {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	return (
		propertyIs(value, 'x', (property) => typeof property === 'number') &&
		propertyIs(value, 'y', (property) => typeof property === 'number') &&
		propertyIs(value, 'width', (property) => typeof property === 'number') &&
		propertyIs(value, 'height', (property) => typeof property === 'number')
	);
}

function isStyle(value: unknown): value is Style {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	return (
		propertyIs(value, 'fill', (property) => typeof property === 'string') &&
		propertyIs(
			value,
			'fillOpacity',
			(property) => typeof property === 'number'
		) &&
		propertyIs(value, 'shadow', (property) => typeof property === 'boolean') &&
		propertyIs(value, 'stroke', (property) => typeof property === 'string') &&
		propertyIs(value, 'text', (property) => typeof property === 'string')
	);
}

/**
 * Structured drawable components for a canonical shape. Each component keeps
 * its clean markup and its sampled contour together so projections can render
 * wobble overlays without parsing generated SVG.
 */
export function shapeComponents(
	kind: ShapeKind,
	box: Box,
	style: Style,
	strokeWidth: number,
	corner?: Corner
): ShapeComponent[] {
	const { x, y, width, height } = box;
	const cx = x + width / 2;
	const cy = y + height / 2;
	const radius = corner === 'sharp' ? 0 : cornerRadius(width, height);
	const { stroke } = style;
	switch (kind) {
		case 'ellipse':
			return [
				{
					clean: ellipse(cx, cy, width / 2, height / 2, style, strokeWidth),
				},
			];
		case 'circle':
			return [
				{
					clean: circle(
						cx,
						cy,
						Math.min(width, height) / 2,
						style,
						strokeWidth
					),
				},
			];
		case 'double-circle': {
			const outer = Math.min(width, height) / 2;
			return [
				{ clean: circle(cx, cy, outer, style, strokeWidth) },
				{
					clean: circle(
						cx,
						cy,
						Math.max(0, outer - 6),
						{ ...style, fill: 'none' },
						strokeWidth
					),
				},
			];
		}
		case 'diamond':
			return [
				{
					clean: path(
						polygonPath([
							[cx, y],
							[x + width, cy],
							[cx, y + height],
							[x, cy],
						]),
						style,
						strokeWidth
					),
				},
			];
		case 'triangle':
			return [
				{
					clean: path(
						polygonPath([
							[cx, y],
							[x + width, y + height],
							[x, y + height],
						]),
						style,
						strokeWidth
					),
				},
			];
		case 'hexagon': {
			const inset = width * 0.2;
			return [
				{
					clean: path(
						polygonPath([
							[x + inset, y],
							[x + width - inset, y],
							[x + width, cy],
							[x + width - inset, y + height],
							[x + inset, y + height],
							[x, cy],
						]),
						style,
						strokeWidth
					),
				},
			];
		}
		case 'parallelogram': {
			const inset = Math.min(20, width * 0.22);
			return [
				{
					clean: path(
						polygonPath([
							[x + inset, y],
							[x + width, y],
							[x + width - inset, y + height],
							[x, y + height],
						]),
						style,
						strokeWidth
					),
				},
			];
		}
		case 'cylinder': {
			const ry = Math.min(12, height * 0.18);
			const body = `M ${x} ${y + ry} V ${y + height - ry} A ${width / 2} ${ry} 0 0 0 ${x + width} ${y + height - ry} V ${y + ry} A ${width / 2} ${ry} 0 0 1 ${x} ${y + ry} Z`;
			return [
				{ clean: path(body, style, strokeWidth) },
				{ clean: ellipse(cx, y + ry, width / 2, ry, style, strokeWidth) },
			];
		}
		case 'cloud':
			return [{ clean: path(cloudPath(box), style, strokeWidth) }];
		case 'heart':
			return [{ clean: path(heartPath(box), style, strokeWidth) }];
		case 'star':
			return [
				{
					clean: path(
						polygonPath(
							starPoints(
								cx,
								cy,
								Math.min(width, height) / 2,
								Math.min(width, height) / 4.2
							)
						),
						style,
						strokeWidth
					),
				},
			];
		case 'bolt':
			return [
				{
					clean: path(
						polygonPath([
							[cx + width * 0.08, y],
							[cx - width * 0.18, cy],
							[cx - width * 0.04, cy],
							[cx - width * 0.1, y + height],
							[cx + width * 0.18, cy],
							[cx + width * 0.04, cy],
						]),
						style,
						strokeWidth
					),
				},
			];
		case 'note':
		case 'sticky':
		case 'speech-bubble':
		case 'callout':
			return [{ clean: path(notePath(box, radius), style, strokeWidth) }];
		case 'document':
			return [{ clean: path(documentPath(box, radius), style, strokeWidth) }];
		case 'actor': {
			const headRadius = Math.min(width, height) * 0.2;
			const headY = y + headRadius + 2;
			const body = `M ${cx} ${headY + headRadius} L ${cx} ${y + height - headRadius * 1.4} M ${x + width * 0.12} ${y + height * 0.62} L ${x + width * 0.88} ${y + height * 0.62} M ${cx} ${y + height - headRadius * 1.4} L ${x + width * 0.15} ${y + height} M ${cx} ${y + height - headRadius * 1.4} L ${x + width * 0.85} ${y + height}`;
			return [
				{
					clean: circle(
						cx,
						headY,
						headRadius,
						{ ...style, fill: 'none' },
						strokeWidth
					),
				},
				{
					clean: `<path d="${body}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
				},
			];
		}
		case 'checkbox':
			return [
				{
					clean: path(
						polygonPath([
							[x + 2, y + 2],
							[x + width - 2, y + 2],
							[x + width - 2, y + height - 2],
							[x + 2, y + height - 2],
						]),
						style,
						strokeWidth
					),
				},
				{
					clean: `<path d="M ${x + width * 0.22} ${cy} L ${x + width * 0.42} ${y + height * 0.66} L ${x + width * 0.8} ${y + height * 0.34}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
				},
			];
		case 'crossbox':
			return [
				{
					clean: path(
						polygonPath([
							[x + 2, y + 2],
							[x + width - 2, y + 2],
							[x + width - 2, y + height - 2],
							[x + 2, y + height - 2],
						]),
						style,
						strokeWidth
					),
				},
				{
					clean: `<path d="M ${x + width * 0.28} ${y + height * 0.28} L ${x + width * 0.72} ${y + height * 0.72} M ${x + width * 0.72} ${y + height * 0.28} L ${x + width * 0.28} ${y + height * 0.72}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`,
				},
			];
		case 'plus':
			return [
				{
					clean: path(
						`M ${cx} ${y + height * 0.2} L ${cx} ${y + height * 0.8} M ${x + width * 0.2} ${cy} L ${x + width * 0.8} ${cy}`,
						{ ...style, fill: 'none' },
						strokeWidth
					),
				},
			];
		case 'delay':
		case 'predefined-process': {
			const inset = 10;
			return [
				{
					clean: path(
						roundedRectPath(x, y, width, height, radius),
						style,
						strokeWidth
					),
				},
				{
					clean: `<path d="M ${x + inset} ${y} V ${y + height} M ${x + width - inset} ${y} V ${y + height}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
				},
			];
		}
		case 'card': {
			const notch = 14;
			return [
				{
					clean: path(
						roundedRectPath(x, y, width, height, radius),
						style,
						strokeWidth
					),
				},
				{
					clean: `<path d="M ${x + width - notch} ${y} L ${x + width - notch} ${y + notch} L ${x + width} ${y + notch}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`,
				},
			];
		}
		default:
			return [
				{
					clean: path(
						roundedRectPath(x, y, width, height, radius),
						style,
						strokeWidth
					),
					contour: {
						closed: true,
						points: sampleRoundedRect(box, radius),
						stroke,
						strokeWidth,
					},
				},
			];
	}
}

/**
 * Return SVG markup for a canonical shape. Unknown kinds and the explicit
 * FALLBACK_SHAPES list deliberately use a rounded rectangle in v1.
 *
 * The numeric overload is retained for callers migrating from the prototype;
 * new callers should pass a Box object.
 */
export function renderShape(
	kind: ShapeKind,
	box: Box,
	style: Style,
	strokeWidth: number,
	corner?: Corner
): string;
export function renderShape(
	kind: ShapeKind,
	x: number,
	y: number,
	width: number,
	height: number,
	style: Style,
	strokeWidth: number,
	corner?: Corner
): string;
export function renderShape(
	kind: ShapeKind,
	boxOrX: unknown,
	yOrStyle?: unknown,
	widthOrStroke?: unknown,
	heightOrStroke?: unknown,
	style?: unknown,
	strokeWidth?: unknown,
	corner?: Corner
): string {
	let box: Box;
	let resolvedStyle: Style;
	let resolvedStrokeWidth: number;
	if (typeof boxOrX === 'number') {
		if (
			typeof yOrStyle !== 'number' ||
			typeof widthOrStroke !== 'number' ||
			typeof heightOrStroke !== 'number' ||
			!isStyle(style) ||
			typeof strokeWidth !== 'number'
		) {
			return '';
		}
		box = {
			height: heightOrStroke,
			width: widthOrStroke,
			x: boxOrX,
			y: yOrStyle,
		};
		resolvedStyle = style;
		resolvedStrokeWidth = strokeWidth;
	} else {
		if (
			!(isBox(boxOrX) && isStyle(yOrStyle)) ||
			typeof widthOrStroke !== 'number'
		) {
			return '';
		}
		box = boxOrX;
		resolvedStyle = yOrStyle;
		resolvedStrokeWidth = widthOrStroke;
	}
	return shapeComponents(kind, box, resolvedStyle, resolvedStrokeWidth, corner)
		.map((component) => component.clean)
		.join('');
}

export { roundedRectPath };
export const SHAPE_INK = INK;
