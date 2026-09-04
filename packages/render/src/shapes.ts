import type { Corner } from '@kiyora/dsl';
import { cornerRadius, INK, type Style } from './style';
import {
	type DrawableContour,
	sampleEllipse,
	samplePolygon,
	samplePolyline,
	sampleRoundedRect,
	sampleSegments,
	type WobblePoint,
	type WobbleSegment,
} from './wobble';

/** A rectangle used as the coordinate space for shape geometry. */
export type Box = { height: number; width: number; x: number; y: number };
export type ShapeKind = string;

/** One drawable component of a shape: its clean markup plus the structured
 * contours needed to render the wobble overlay without parsing generated SVG.
 * Components without contours are rendered clean only. Multi-subpath open
 * elements (actor limbs, crosses, rule lines) carry one contour per stroke. */
export type ShapeComponent = {
	clean: string;
	contours?: DrawableContour[];
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

function cloudGeometry(box: Box): { d: string; segments: WobbleSegment[] } {
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	const rx = box.width / 2;
	const ry = box.height / 2;
	const arcs = [
		{ dx: 0, dy: -ry * 0.45, rx: rx * 0.28, ry: ry * 0.28 },
		{ dx: rx * 0.75, dy: -ry * 0.1, rx: rx * 0.35, ry: ry * 0.35 },
		{ dx: rx * 0.6, dy: ry * 0.55, rx: rx * 0.35, ry: ry * 0.35 },
		{ dx: 0, dy: ry * 0.5, rx: rx * 0.22, ry: ry * 0.22 },
		{ dx: -rx * 0.8, dy: ry * 0.05, rx: rx * 0.3, ry: ry * 0.3 },
		{ dx: -rx * 0.55, dy: -ry * 0.55, rx: rx * 0.28, ry: ry * 0.28 },
	];
	const start: WobblePoint = [cx - rx * 0.5, cy];
	const d = [
		`M ${start[0]} ${start[1]}`,
		...arcs.map((arc) => `a ${arc.rx} ${arc.ry} 0 0 1 ${arc.dx} ${arc.dy}`),
		'Z',
	].join(' ');
	const segments: WobbleSegment[] = [];
	let cursor: WobblePoint = start;
	for (const arc of arcs) {
		const to: WobblePoint = [cursor[0] + arc.dx, cursor[1] + arc.dy];
		segments.push({
			from: cursor,
			largeArc: false,
			rx: arc.rx,
			ry: arc.ry,
			sweep: true,
			to,
			type: 'arc',
		});
		cursor = to;
	}
	return { d, segments };
}

type CurveVertex = { c1: WobblePoint; c2: WobblePoint; to: WobblePoint };

function heartGeometry(box: Box): { d: string; segments: WobbleSegment[] } {
	const cx = box.x + box.width / 2;
	const bottom = box.y + box.height;
	const { x, y, width, height } = box;
	const cubics: CurveVertex[] = [
		{
			c1: [x - width * 0.05, y + height * 0.62],
			c2: [x, y + height * 0.28],
			to: [x + width * 0.25, y + height * 0.28],
		},
		{
			c1: [x + width * 0.45, y + height * 0.28],
			c2: [cx, y + height * 0.55],
			to: [cx, y + height * 0.45],
		},
		{
			c1: [cx, y + height * 0.55],
			c2: [x + width * 0.55, y + height * 0.28],
			to: [x + width * 0.75, y + height * 0.28],
		},
		{
			c1: [x + width, y + height * 0.28],
			c2: [x + width * 1.05, y + height * 0.62],
			to: [cx, bottom],
		},
	];
	const start: WobblePoint = [cx, bottom];
	const d = [
		`M ${start[0]} ${start[1]}`,
		...cubics.map(
			(cubic) =>
				`C ${cubic.c1[0]} ${cubic.c1[1]}, ${cubic.c2[0]} ${cubic.c2[1]}, ${cubic.to[0]} ${cubic.to[1]}`
		),
		'Z',
	].join(' ');
	const segments: WobbleSegment[] = [];
	let cursor: WobblePoint = start;
	for (const cubic of cubics) {
		segments.push({
			c1: cubic.c1,
			c2: cubic.c2,
			from: cursor,
			to: cubic.to,
			type: 'cubic',
		});
		cursor = cubic.to;
	}
	return { d, segments };
}

function documentGeometry(
	box: Box,
	radius: number
): { d: string; segments: WobbleSegment[] } {
	const wave = box.height * 0.18;
	const { x, y, width, height } = box;
	const d = [
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
	const segments: WobbleSegment[] = [
		{ from: [x + radius, y], to: [x + width - radius, y], type: 'line' },
		{
			from: [x + width - radius, y],
			largeArc: false,
			rx: radius,
			ry: radius,
			sweep: true,
			to: [x + width, y + radius],
			type: 'arc',
		},
		{
			from: [x + width, y + radius],
			to: [x + width, y + height - wave],
			type: 'line',
		},
		{
			c1: [x + width * 0.75, y + height],
			c2: [x + width * 0.5, y + height - wave * 0.6],
			from: [x + width, y + height - wave],
			to: [x + width * 0.25, y + height],
			type: 'cubic',
		},
		{
			c1: [x + width * 0.12, y + height - wave * 0.4],
			c2: [x, y + height - wave],
			from: [x + width * 0.25, y + height],
			to: [x, y + height - wave],
			type: 'cubic',
		},
		{ from: [x, y + height - wave], to: [x, y + radius], type: 'line' },
		{
			from: [x, y + radius],
			largeArc: false,
			rx: radius,
			ry: radius,
			sweep: true,
			to: [x + radius, y],
			type: 'arc',
		},
	];
	return { d, segments };
}

function noteGeometry(
	box: Box,
	radius: number
): { d: string; segments: WobbleSegment[] } {
	const fold = Math.min(16, box.width * 0.2, box.height * 0.3);
	const { x, y, width, height } = box;
	const d = [
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
	const segments: WobbleSegment[] = [
		{ from: [x + radius, y], to: [x + width - fold, y], type: 'line' },
		{ from: [x + width - fold, y], to: [x + width, y + fold], type: 'line' },
		{
			from: [x + width, y + fold],
			to: [x + width, y + height - radius],
			type: 'line',
		},
		{
			from: [x + width, y + height - radius],
			largeArc: false,
			rx: radius,
			ry: radius,
			sweep: true,
			to: [x + width - radius, y + height],
			type: 'arc',
		},
		{
			from: [x + width - radius, y + height],
			to: [x + radius, y + height],
			type: 'line',
		},
		{
			from: [x + radius, y + height],
			largeArc: false,
			rx: radius,
			ry: radius,
			sweep: true,
			to: [x, y + height - radius],
			type: 'arc',
		},
		{ from: [x, y + height - radius], to: [x, y + radius], type: 'line' },
		{
			from: [x, y + radius],
			largeArc: false,
			rx: radius,
			ry: radius,
			sweep: true,
			to: [x + radius, y],
			type: 'arc',
		},
	];
	return { d, segments };
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

function contour(
	closed: boolean,
	points: WobblePoint[],
	stroke: string,
	strokeWidth: number
): DrawableContour {
	return { closed, points, stroke, strokeWidth };
}

/**
 * Structured drawable components for a canonical shape. Each component keeps
 * its clean markup and its sampled contours together so projections can render
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
					contours: [
						contour(
							true,
							sampleEllipse(cx, cy, width / 2, height / 2),
							stroke,
							strokeWidth
						),
					],
				},
			];
		case 'circle': {
			const r = Math.min(width, height) / 2;
			return [
				{
					clean: circle(cx, cy, r, style, strokeWidth),
					contours: [
						contour(true, sampleEllipse(cx, cy, r, r), stroke, strokeWidth),
					],
				},
			];
		}
		case 'double-circle': {
			const outer = Math.min(width, height) / 2;
			const inner = Math.max(0, outer - 6);
			return [
				{
					clean: circle(cx, cy, outer, style, strokeWidth),
					contours: [
						contour(
							true,
							sampleEllipse(cx, cy, outer, outer),
							stroke,
							strokeWidth
						),
					],
				},
				{
					clean: circle(cx, cy, inner, { ...style, fill: 'none' }, strokeWidth),
					contours:
						inner > 0
							? [
									contour(
										true,
										sampleEllipse(cx, cy, inner, inner),
										stroke,
										strokeWidth
									),
								]
							: undefined,
				},
			];
		}
		case 'diamond': {
			const vertices: WobblePoint[] = [
				[cx, y],
				[x + width, cy],
				[cx, y + height],
				[x, cy],
			];
			return [
				{
					clean: path(polygonPath(vertices), style, strokeWidth),
					contours: [
						contour(true, samplePolygon(vertices), stroke, strokeWidth),
					],
				},
			];
		}
		case 'triangle': {
			const vertices: WobblePoint[] = [
				[cx, y],
				[x + width, y + height],
				[x, y + height],
			];
			return [
				{
					clean: path(polygonPath(vertices), style, strokeWidth),
					contours: [
						contour(true, samplePolygon(vertices), stroke, strokeWidth),
					],
				},
			];
		}
		case 'hexagon': {
			const inset = width * 0.2;
			const vertices: WobblePoint[] = [
				[x + inset, y],
				[x + width - inset, y],
				[x + width, cy],
				[x + width - inset, y + height],
				[x + inset, y + height],
				[x, cy],
			];
			return [
				{
					clean: path(polygonPath(vertices), style, strokeWidth),
					contours: [
						contour(true, samplePolygon(vertices), stroke, strokeWidth),
					],
				},
			];
		}
		case 'parallelogram': {
			const inset = Math.min(20, width * 0.22);
			const vertices: WobblePoint[] = [
				[x + inset, y],
				[x + width, y],
				[x + width - inset, y + height],
				[x, y + height],
			];
			return [
				{
					clean: path(polygonPath(vertices), style, strokeWidth),
					contours: [
						contour(true, samplePolygon(vertices), stroke, strokeWidth),
					],
				},
			];
		}
		case 'cylinder': {
			const ry = Math.min(12, height * 0.18);
			const segments: WobbleSegment[] = [
				{ from: [x, y + ry], to: [x, y + height - ry], type: 'line' },
				{
					from: [x, y + height - ry],
					largeArc: false,
					rx: width / 2,
					ry,
					sweep: false,
					to: [x + width, y + height - ry],
					type: 'arc',
				},
				{
					from: [x + width, y + height - ry],
					to: [x + width, y + ry],
					type: 'line',
				},
				{
					from: [x + width, y + ry],
					largeArc: false,
					rx: width / 2,
					ry,
					sweep: true,
					to: [x, y + ry],
					type: 'arc',
				},
			];
			const body = `M ${x} ${y + ry} V ${y + height - ry} A ${width / 2} ${ry} 0 0 0 ${x + width} ${y + height - ry} V ${y + ry} A ${width / 2} ${ry} 0 0 1 ${x} ${y + ry} Z`;
			return [
				{
					clean: path(body, style, strokeWidth),
					contours: [
						contour(true, sampleSegments(segments, true), stroke, strokeWidth),
					],
				},
				{
					clean: ellipse(cx, y + ry, width / 2, ry, style, strokeWidth),
					contours: [
						contour(
							true,
							sampleEllipse(cx, y + ry, width / 2, ry),
							stroke,
							strokeWidth
						),
					],
				},
			];
		}
		case 'cloud': {
			const geometry = cloudGeometry(box);
			return [
				{
					clean: path(geometry.d, style, strokeWidth),
					contours: [
						contour(
							true,
							sampleSegments(geometry.segments, true),
							stroke,
							strokeWidth
						),
					],
				},
			];
		}
		case 'heart': {
			const geometry = heartGeometry(box);
			return [
				{
					clean: path(geometry.d, style, strokeWidth),
					contours: [
						contour(
							true,
							sampleSegments(geometry.segments, true),
							stroke,
							strokeWidth
						),
					],
				},
			];
		}
		case 'star': {
			const vertices = starPoints(
				cx,
				cy,
				Math.min(width, height) / 2,
				Math.min(width, height) / 4.2
			);
			return [
				{
					clean: path(polygonPath(vertices), style, strokeWidth),
					contours: [
						contour(true, samplePolygon(vertices), stroke, strokeWidth),
					],
				},
			];
		}
		case 'bolt': {
			const vertices: WobblePoint[] = [
				[cx + width * 0.08, y],
				[cx - width * 0.18, cy],
				[cx - width * 0.04, cy],
				[cx - width * 0.1, y + height],
				[cx + width * 0.18, cy],
				[cx + width * 0.04, cy],
			];
			return [
				{
					clean: path(polygonPath(vertices), style, strokeWidth),
					contours: [
						contour(true, samplePolygon(vertices), stroke, strokeWidth),
					],
				},
			];
		}
		case 'note':
		case 'sticky':
		case 'speech-bubble':
		case 'callout': {
			const geometry = noteGeometry(box, radius);
			return [
				{
					clean: path(geometry.d, style, strokeWidth),
					contours: [
						contour(
							true,
							sampleSegments(geometry.segments, true),
							stroke,
							strokeWidth
						),
					],
				},
			];
		}
		case 'document': {
			const geometry = documentGeometry(box, radius);
			return [
				{
					clean: path(geometry.d, style, strokeWidth),
					contours: [
						contour(
							true,
							sampleSegments(geometry.segments, true),
							stroke,
							strokeWidth
						),
					],
				},
			];
		}
		case 'actor': {
			const headRadius = Math.min(width, height) * 0.2;
			const headY = y + headRadius + 2;
			const neck: WobblePoint = [cx, headY + headRadius];
			const hip: WobblePoint = [cx, y + height - headRadius * 1.4];
			const strokes: WobblePoint[][] = [
				[neck, hip],
				[
					[x + width * 0.12, y + height * 0.62],
					[x + width * 0.88, y + height * 0.62],
				],
				[hip, [x + width * 0.15, y + height]],
				[hip, [x + width * 0.85, y + height]],
			];
			const body = strokes
				.map(
					(strokePoints) =>
						`M ${strokePoints[0]?.[0]} ${strokePoints[0]?.[1]} L ${strokePoints[1]?.[0]} ${strokePoints[1]?.[1]}`
				)
				.join(' ');
			return [
				{
					clean: circle(
						cx,
						headY,
						headRadius,
						{ ...style, fill: 'none' },
						strokeWidth
					),
					contours:
						headRadius > 0
							? [
									contour(
										true,
										sampleEllipse(cx, headY, headRadius, headRadius),
										stroke,
										strokeWidth
									),
								]
							: undefined,
				},
				{
					clean: `<path d="${body}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
					contours: strokes.map((strokePoints) =>
						contour(false, samplePolyline(strokePoints), stroke, strokeWidth)
					),
				},
			];
		}
		case 'checkbox': {
			const frame: WobblePoint[] = [
				[x + 2, y + 2],
				[x + width - 2, y + 2],
				[x + width - 2, y + height - 2],
				[x + 2, y + height - 2],
			];
			const mark: WobblePoint[] = [
				[x + width * 0.22, cy],
				[x + width * 0.42, y + height * 0.66],
				[x + width * 0.8, y + height * 0.34],
			];
			return [
				{
					clean: path(polygonPath(frame), style, strokeWidth),
					contours: [contour(true, samplePolygon(frame), stroke, strokeWidth)],
				},
				{
					clean: `<path d="M ${mark[0]?.[0]} ${mark[0]?.[1]} L ${mark[1]?.[0]} ${mark[1]?.[1]} L ${mark[2]?.[0]} ${mark[2]?.[1]}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
					contours: [contour(false, samplePolyline(mark), stroke, strokeWidth)],
				},
			];
		}
		case 'crossbox': {
			const frame: WobblePoint[] = [
				[x + 2, y + 2],
				[x + width - 2, y + 2],
				[x + width - 2, y + height - 2],
				[x + 2, y + height - 2],
			];
			const diagonals: WobblePoint[][] = [
				[
					[x + width * 0.28, y + height * 0.28],
					[x + width * 0.72, y + height * 0.72],
				],
				[
					[x + width * 0.72, y + height * 0.28],
					[x + width * 0.28, y + height * 0.72],
				],
			];
			const cross = diagonals
				.map(
					(diagonal) =>
						`M ${diagonal[0]?.[0]} ${diagonal[0]?.[1]} L ${diagonal[1]?.[0]} ${diagonal[1]?.[1]}`
				)
				.join(' ');
			return [
				{
					clean: path(polygonPath(frame), style, strokeWidth),
					contours: [contour(true, samplePolygon(frame), stroke, strokeWidth)],
				},
				{
					clean: `<path d="${cross}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`,
					contours: diagonals.map((diagonal) =>
						contour(false, samplePolyline(diagonal), stroke, strokeWidth)
					),
				},
			];
		}
		case 'plus': {
			const bars: WobblePoint[][] = [
				[
					[cx, y + height * 0.2],
					[cx, y + height * 0.8],
				],
				[
					[x + width * 0.2, cy],
					[x + width * 0.8, cy],
				],
			];
			const d = bars
				.map(
					(bar) =>
						`M ${bar[0]?.[0]} ${bar[0]?.[1]} L ${bar[1]?.[0]} ${bar[1]?.[1]}`
				)
				.join(' ');
			return [
				{
					clean: path(d, { ...style, fill: 'none' }, strokeWidth),
					contours: bars.map((bar) =>
						contour(false, samplePolyline(bar), stroke, strokeWidth)
					),
				},
			];
		}
		case 'delay':
		case 'predefined-process': {
			const inset = 10;
			const rules: WobblePoint[][] = [
				[
					[x + inset, y],
					[x + inset, y + height],
				],
				[
					[x + width - inset, y],
					[x + width - inset, y + height],
				],
			];
			return [
				{
					clean: path(
						roundedRectPath(x, y, width, height, radius),
						style,
						strokeWidth
					),
					contours: [
						contour(true, sampleRoundedRect(box, radius), stroke, strokeWidth),
					],
				},
				{
					clean: `<path d="M ${rules[0]?.[0]?.[0]} ${y} V ${y + height} M ${rules[1]?.[0]?.[0]} ${y} V ${y + height}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
					contours: rules.map((rule) =>
						contour(false, samplePolyline(rule), stroke, strokeWidth)
					),
				},
			];
		}
		case 'card': {
			const notch = 14;
			const fold: WobblePoint[] = [
				[x + width - notch, y],
				[x + width - notch, y + notch],
				[x + width, y + notch],
			];
			return [
				{
					clean: path(
						roundedRectPath(x, y, width, height, radius),
						style,
						strokeWidth
					),
					contours: [
						contour(true, sampleRoundedRect(box, radius), stroke, strokeWidth),
					],
				},
				{
					clean: `<path d="M ${fold[0]?.[0]} ${fold[0]?.[1]} L ${fold[1]?.[0]} ${fold[1]?.[1]} L ${fold[2]?.[0]} ${fold[2]?.[1]}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`,
					contours: [contour(false, samplePolyline(fold), stroke, strokeWidth)],
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
					contours: [
						contour(true, sampleRoundedRect(box, radius), stroke, strokeWidth),
					],
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
