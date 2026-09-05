import { getStroke } from 'perfect-freehand';
import type { Box } from './geometry';

export type WobblePoint = [number, number];

/** One drawable component of a shape or frame: a sampled contour plus the
 * stroke attributes needed to render its clean and wobble layers together. */
export type DrawableContour = {
	closed: boolean;
	points: WobblePoint[];
	stroke: string;
	strokeWidth: number;
};

const FREEHAND_OPTIONS = {
	size: 5,
	smoothing: 0.5,
	streamline: 0.32,
	thinning: 0,
} as const;

const SAMPLE_SPACING = 5;
export const WOBBLE_OPACITY = 0.66;

const LEHMER_MODULUS = 2_147_483_647;
const LEHMER_MULTIPLIER = 16_807;
/** Prime stride between sibling contours sharing one component seed, so
 * mirrored sub-contours within a compound shape never look stamped. */
const CONTOUR_SEED_STRIDE = 7919;

/** Rolling Lehmer hash over stable identity and current local geometry.
 * Viewport state is intentionally excluded so pan and zoom never change the
 * pattern. */
export function deriveWobbleSeed(
	identity: string,
	parts: readonly (number | string)[]
): number {
	let hash = 1_103_515_245 % LEHMER_MODULUS;
	const input = `${identity}|${parts.join(',')}`;
	for (let index = 0; index < input.length; index += 1) {
		const code = input.charCodeAt(index);
		hash = ((hash + code) * LEHMER_MULTIPLIER) % LEHMER_MODULUS;
	}
	return hash;
}

/** Lehmer LCG seeded by the element seed; deterministic per call sequence. */
function randomFor(seed: number): () => number {
	let state = (seed % (LEHMER_MODULUS - 1)) + 1;
	return () => {
		state = (state * LEHMER_MULTIPLIER) % LEHMER_MODULUS;
		return state / LEHMER_MODULUS;
	};
}

/** Interpolate dense samples along straight edges between the given vertices. */
function densify(
	vertices: readonly WobblePoint[],
	closed: boolean
): WobblePoint[] {
	const points: WobblePoint[] = [];
	const edgeCount = closed ? vertices.length : vertices.length - 1;
	for (let index = 0; index < edgeCount; index += 1) {
		const from = vertices[index];
		const to = vertices[(index + 1) % vertices.length];
		if (!(from && to)) {
			continue;
		}
		const steps = Math.max(
			1,
			Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / SAMPLE_SPACING)
		);
		for (let step = 0; step < steps; step += 1) {
			const t = step / steps;
			points.push([
				from[0] + (to[0] - from[0]) * t,
				from[1] + (to[1] - from[1]) * t,
			]);
		}
	}
	const last = vertices.at(-1);
	if (!(closed || last === undefined)) {
		const [lastX, lastY] = last;
		points.push([lastX, lastY]);
	}
	const [firstX = 0, firstY = 0] = points[0] ?? [];
	if (closed) {
		points.push([firstX, firstY]);
	}
	return points;
}

/** Closed rounded-rectangle segment table: the single source for both the
 * clean `roundedRectPath` markup and the sampled contour below. */
export function roundedRectSegments(box: Box, radius: number): WobbleSegment[] {
	const r = Math.max(0, Math.min(radius, box.width / 2, box.height / 2));
	const { height, width, x, y } = box;
	const corner = (from: WobblePoint, to: WobblePoint): WobbleSegment => ({
		from,
		largeArc: false,
		rx: r,
		ry: r,
		sweep: true,
		to,
		type: 'arc',
	});
	return [
		{ from: [x + r, y], to: [x + width - r, y], type: 'line' },
		corner([x + width - r, y], [x + width, y + r]),
		{ from: [x + width, y + r], to: [x + width, y + height - r], type: 'line' },
		corner([x + width, y + height - r], [x + width - r, y + height]),
		{
			from: [x + width - r, y + height],
			to: [x + r, y + height],
			type: 'line',
		},
		corner([x + r, y + height], [x, y + height - r]),
		{ from: [x, y + height - r], to: [x, y + r], type: 'line' },
		corner([x, y + r], [x + r, y]),
	];
}

/** Closed ring approximating the same rounded rectangle as `roundedRectPath`. */
export function sampleRoundedRect(box: Box, radius: number): WobblePoint[] {
	return sampleSegments(roundedRectSegments(box, radius), true);
}

/** Closed ring through the given polygon vertices. */
export function samplePolygon(vertices: readonly WobblePoint[]): WobblePoint[] {
	return densify(vertices, true);
}

/** Closed ring approximating an ellipse. */
export function sampleEllipse(
	cx: number,
	cy: number,
	rx: number,
	ry: number
): WobblePoint[] {
	const steps = Math.max(
		24,
		Math.ceil((2 * Math.PI * Math.max(rx, ry)) / SAMPLE_SPACING)
	);
	const points: WobblePoint[] = [];
	for (let index = 0; index < steps; index += 1) {
		const angle = (2 * Math.PI * index) / steps;
		points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
	}
	const [firstX = 0, firstY = 0] = points[0] ?? [];
	points.push([firstX, firstY]);
	return points;
}

/** Open polyline through the given vertices. */
export function samplePolyline(
	vertices: readonly WobblePoint[]
): WobblePoint[] {
	return densify(vertices, false);
}

/** Dense open sample of a single straight segment, anchored on both endpoints. */
function sampleLine(from: WobblePoint, to: WobblePoint): WobblePoint[] {
	const steps = Math.max(
		1,
		Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / SAMPLE_SPACING)
	);
	const points: WobblePoint[] = [];
	for (let index = 0; index <= steps; index += 1) {
		const t = index / steps;
		points.push([
			from[0] + (to[0] - from[0]) * t,
			from[1] + (to[1] - from[1]) * t,
		]);
	}
	points[0] = [from[0], from[1]];
	points[points.length - 1] = [to[0], to[1]];
	return points;
}

const TAU = Math.PI * 2;

/** Wrap any angle into `[0, TAU)`. */
function normalizeAngle(value: number): number {
	const angle = value % TAU;
	return angle < 0 ? angle + TAU : angle;
}

/** Signed angle from vector u to vector v, shortest way around. */
function angleBetween(ux: number, uy: number, vx: number, vy: number): number {
	const dot = ux * vx + uy * vy;
	const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
	let value = Math.acos(Math.max(-1, Math.min(1, dot / length)));
	if (ux * vy - uy * vx < 0) {
		value = -value;
	}
	return value;
}

/** Endpoint-to-center conversion for an unrotated elliptical arc (SVG spec
 * F.6), reused to sample the same arc the clean path draws. */
function sampleArc(
	from: WobblePoint,
	to: WobblePoint,
	rx: number,
	ry: number,
	largeArc: boolean,
	sweep: boolean
): WobblePoint[] {
	if (rx === 0 || ry === 0) {
		return sampleLine(from, to);
	}
	const [x1, y1] = from;
	const [x2, y2] = to;
	const halfX = (x1 - x2) / 2;
	const halfY = (y1 - y2) / 2;
	const lambda = (halfX * halfX) / (rx * rx) + (halfY * halfY) / (ry * ry);
	let radiusX = rx;
	let radiusY = ry;
	if (lambda > 1) {
		const scale = Math.sqrt(lambda);
		radiusX *= scale;
		radiusY *= scale;
	}
	const sign = largeArc === sweep ? -1 : 1;
	const numerator =
		radiusX * radiusX * radiusY * radiusY -
		radiusX * radiusX * halfY * halfY -
		radiusY * radiusY * halfX * halfX;
	const denominator =
		radiusX * radiusX * halfY * halfY + radiusY * radiusY * halfX * halfX;
	const factor = sign * Math.sqrt(Math.max(0, numerator) / (denominator || 1));
	const centerPrimeX = (factor * radiusX * halfY) / radiusY;
	const centerPrimeY = (-factor * radiusY * halfX) / radiusX;
	const centerX = centerPrimeX + (x1 + x2) / 2;
	const centerY = centerPrimeY + (y1 + y2) / 2;
	const startAngle = normalizeAngle(
		Math.atan2(
			(halfY - centerPrimeY) / radiusY,
			(halfX - centerPrimeX) / radiusX
		)
	);
	let delta = angleBetween(
		(halfX - centerPrimeX) / radiusX,
		(halfY - centerPrimeY) / radiusY,
		(-halfX - centerPrimeX) / radiusX,
		(-halfY - centerPrimeY) / radiusY
	);
	if (delta === 0) {
		return sampleLine([x1, y1], [x2, y2]);
	}
	if (!sweep && delta > 0) {
		delta -= TAU;
	} else if (sweep && delta < 0) {
		delta += TAU;
	}
	const steps = Math.max(
		4,
		Math.ceil((Math.abs(delta) * Math.max(radiusX, radiusY)) / SAMPLE_SPACING)
	);
	const points: WobblePoint[] = [];
	for (let index = 0; index <= steps; index += 1) {
		const angle = startAngle + (delta * index) / steps;
		points.push([
			centerX + radiusX * Math.cos(angle),
			centerY + radiusY * Math.sin(angle),
		]);
	}
	points[0] = [x1, y1];
	points[points.length - 1] = [x2, y2];
	return points;
}

/** One drawable contour segment expressed in absolute coordinates, mirroring
 * the `L`, `C`, and `A` commands used by the clean shape paths. */
export type WobbleSegment =
	| { from: WobblePoint; to: WobblePoint; type: 'line' }
	| {
			c1: WobblePoint;
			c2: WobblePoint;
			from: WobblePoint;
			to: WobblePoint;
			type: 'cubic';
	  }
	| {
			from: WobblePoint;
			largeArc?: boolean;
			rx: number;
			ry: number;
			sweep: boolean;
			to: WobblePoint;
			type: 'arc';
	  };

/** Dense point samples for one drawable segment, whatever its command kind. */
function sampleSegment(segment: WobbleSegment): WobblePoint[] {
	switch (segment.type) {
		case 'line':
			return sampleLine(segment.from, segment.to);
		case 'cubic':
			return sampleCubic(segment.from, segment.c1, segment.c2, segment.to);
		default:
			return sampleArc(
				segment.from,
				segment.to,
				segment.rx,
				segment.ry,
				segment.largeArc ?? false,
				segment.sweep
			);
	}
}

/** Stitches absolute segments into one dense contour without duplicating the
 * shared anchor points between consecutive segments. */
export function sampleSegments(
	segments: readonly WobbleSegment[],
	closed: boolean
): WobblePoint[] {
	const points: WobblePoint[] = [];
	for (const segment of segments) {
		const sampled = sampleSegment(segment);
		const offset = points.length === 0 ? 0 : 1;
		for (let index = offset; index < sampled.length; index += 1) {
			const current = sampled[index];
			if (current) {
				points.push([current[0], current[1]]);
			}
		}
		if (points.length === 0) {
			const [firstX = 0, firstY = 0] = segment.from;
			points.push([firstX, firstY]);
		}
	}
	if (closed) {
		const [firstX = 0, firstY = 0] = points[0] ?? [];
		const last = points.at(-1);
		if (last && (last[0] !== firstX || last[1] !== firstY)) {
			const closing = sampleLine(last, [firstX, firstY]);
			for (let index = 1; index < closing.length; index += 1) {
				const current = closing[index];
				if (current) {
					points.push([current[0], current[1]]);
				}
			}
		}
	}
	return points;
}

/** Open cubic sample; the same curve as an SVG `C` command. */
export function sampleCubic(
	p0: WobblePoint,
	p1: WobblePoint,
	p2: WobblePoint,
	p3: WobblePoint
): WobblePoint[] {
	const steps = Math.max(
		8,
		Math.ceil(Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) / SAMPLE_SPACING)
	);
	const points: WobblePoint[] = [];
	for (let index = 0; index <= steps; index += 1) {
		const t = index / steps;
		if (index === 0) {
			points.push([p0[0], p0[1]]);
			continue;
		}
		if (index === steps) {
			points.push([p3[0], p3[1]]);
			continue;
		}
		const u = 1 - t;
		const a = u * u * u;
		const b = 3 * u * u * t;
		const c = 3 * u * t * t;
		const d = t * t * t;
		points.push([
			a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
			a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
		]);
	}
	return points;
}

/** Canonical perfect-freehand `getSvgPathFromStroke` rendering (smooth
 * quadratics through the stroke polygon midpoints), with coordinates rounded
 * for compact deterministic markup. */
function getSvgPathFromStroke(points: readonly WobblePoint[]): string {
	if (points.length === 0) {
		return '';
	}
	const round = (value: number): string => Number(value.toFixed(2)).toString();
	const [startX = 0, startY = 0] = points[0] ?? [];
	const parts: string[] = ['M', round(startX), round(startY), 'Q'];
	for (let index = 0; index < points.length; index += 1) {
		const current = points[index];
		const next = points[(index + 1) % points.length];
		if (!(current && next)) {
			continue;
		}
		parts.push(
			round(current[0]),
			round(current[1]),
			round((current[0] + next[0]) / 2),
			round((current[1] + next[1]) / 2)
		);
	}
	parts.push('Z');
	return parts.join(' ');
}

/** Deterministic freehand outline for one contour, or `''` when the input is
 * too degenerate to decorate. */
export function wobbleOverlayMarkup(
	seed: number,
	contour: DrawableContour
): string {
	const usable = contour.points.filter(
		([px, py]) => Number.isFinite(px) && Number.isFinite(py)
	);
	const [originX = 0, originY = 0] = usable[0] ?? [];
	const hasExtent = usable.some(([px, py]) => px !== originX || py !== originY);
	if (usable.length < 2 || !hasExtent) {
		return '';
	}
	const random = randomFor(seed);
	const amplitude = Math.max(0.6, contour.strokeWidth * 0.55);
	const shifted = usable.map(
		([px, py]): WobblePoint => [
			px + (random() * 2 - 1) * amplitude,
			py + (random() * 2 - 1) * amplitude,
		]
	);
	const last = usable.at(-1);
	const [headX = 0, headY = 0] = shifted[0] ?? [];
	if (contour.closed && last && last[0] === originX && last[1] === originY) {
		shifted[shifted.length - 1] = [headX, headY];
	}
	const outline = getStroke(shifted, {
		...FREEHAND_OPTIONS,
		// Closes the sampled loop so the outline returns to the first point.
		...(contour.closed ? { last: true } : {}),
	});
	if (outline.length < 2) {
		return '';
	}
	const d = getSvgPathFromStroke(outline);
	if (d.length === 0) {
		return '';
	}
	return `<path data-wobble="true" pointer-events="none" d="${d}" fill="${contour.stroke}" fill-opacity="${WOBBLE_OPACITY}"/>`;
}

/** Overlay markup for every contour of an element that shares one seed base;
 * each contour gets its own seed variation so similar sub-contours within one
 * component never look stamped. Contours that cannot produce an outline are
 * skipped individually. */
export function wobbleOverlayGroup(
	seed: number,
	contours: readonly DrawableContour[]
): string {
	return contours
		.map((contour, index) =>
			wobbleOverlayMarkup(seed + index * CONTOUR_SEED_STRIDE, contour)
		)
		.join('');
}

/** Split a dense contour into one point run per visible dash, so a dashed
 * clean line keeps its gaps beneath the wobble overlay. Runs shorter than two
 * points are dropped. Open contours start their first dash on the first point.
 * Closed contours phase the pattern cyclically so the ring seam always lands
 * inside a gap and no dash straddles the closure. */
function dashRuns(
	points: readonly WobblePoint[],
	dash: number,
	gap: number,
	closed: boolean
): WobblePoint[][] {
	const [first] = points;
	if (dash <= 0 || gap <= 0 || points.length < 2 || first === undefined) {
		return [points.slice()];
	}
	const runs: WobblePoint[][] = [];
	// A closed ring centres a gap on its seam so no dash straddles the
	// closure; an open contour starts its first dash on the first point.
	let drawing = !closed;
	let travelled = closed ? gap / 2 : 0;
	let run: WobblePoint[] = closed ? [] : [first];
	// A closed ring may end inside a partial dash at the seam; that run is
	// dropped so ink never piles up where the ring closes.
	const flush = (atSeam: boolean): void => {
		if (!drawing || run.length < 2) {
			return;
		}
		if (!(atSeam && closed && travelled < dash)) {
			runs.push(run);
		}
	};
	for (let index = 1; index < points.length; index += 1) {
		const from = points[index - 1];
		const to = points[index];
		if (!(from && to)) {
			continue;
		}
		const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
		if (length === 0) {
			if (drawing) {
				run.push(to);
			}
			continue;
		}
		let consumed = 0;
		while (consumed < length) {
			const until = (drawing ? dash : gap) - travelled;
			if (length - consumed <= until) {
				travelled += length - consumed;
				if (drawing) {
					run.push(to);
				}
				break;
			}
			const t = (consumed + until) / length;
			const boundary: WobblePoint = [
				from[0] + (to[0] - from[0]) * t,
				from[1] + (to[1] - from[1]) * t,
			];
			if (drawing) {
				run.push(boundary);
			}
			flush(false);
			drawing = !drawing;
			run = [boundary];
			travelled = 0;
			consumed += until;
		}
	}
	flush(true);
	return runs.filter((candidate) => candidate.length >= 2);
}

/** Overlay markup for a dashed contour: one freehand run per dash, each with
 * its own seed variation so repeated dashes do not look stamped. A closed
 * contour keeps its ring topology by tiling the dash cycle cyclically around
 * the seam while each band stays individually open with rounded ends. */
export function wobbleOverlayDashedMarkup(
	seed: number,
	contour: DrawableContour,
	dash: number,
	gap: number
): string {
	return dashRuns(contour.points, dash, gap, contour.closed)
		.map((points, index) =>
			wobbleOverlayMarkup(seed + index * CONTOUR_SEED_STRIDE, {
				...contour,
				closed: false,
				points,
			})
		)
		.join('');
}
