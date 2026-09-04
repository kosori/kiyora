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
const ARC_SEGMENTS = 5;
export const WOBBLE_OPACITY = 0.66;

const LEHMER_MODULUS = 2_147_483_647;
const LEHMER_MULTIPLIER = 16_807;

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

/** Closed ring approximating the same rounded rectangle as `roundedRectPath`. */
export function sampleRoundedRect(box: Box, radius: number): WobblePoint[] {
	const r = Math.max(0, Math.min(radius, box.width / 2, box.height / 2));
	const { height, width, x, y } = box;
	const vertices: WobblePoint[] = [];
	const arc = (cx: number, cy: number, start: number): void => {
		for (let step = 1; step < ARC_SEGMENTS; step += 1) {
			const angle = start + (Math.PI * step) / (2 * ARC_SEGMENTS);
			vertices.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
		}
	};
	vertices.push([x + r, y], [x + width - r, y]);
	if (r > 0) {
		arc(x + width - r, y + r, -Math.PI / 2);
	}
	vertices.push([x + width, y + r], [x + width, y + height - r]);
	if (r > 0) {
		arc(x + width - r, y + height - r, 0);
	}
	vertices.push([x + width - r, y + height], [x + r, y + height]);
	if (r > 0) {
		arc(x + r, y + height - r, Math.PI / 2);
	}
	vertices.push([x, y + height - r], [x, y + r]);
	if (r > 0) {
		arc(x + r, y + r, Math.PI);
	}
	return densify(vertices, true);
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

/** Open polyline approximating a cubic Bézier curve. */
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

function strokePath(points: readonly WobblePoint[]): string {
	const round = (value: number): string => Number(value.toFixed(2)).toString();
	const [startX = 0, startY = 0] = points[0] ?? [];
	const pairs: string[] = [];
	for (let index = 0; index < points.length; index += 1) {
		const current = points[index];
		const next = points[(index + 1) % points.length];
		if (!(current && next)) {
			continue;
		}
		const [cx, cy] = current;
		const [nx, ny] = next;
		pairs.push(
			`${round(cx)} ${round(cy)}`,
			`${round((cx + nx) / 2)} ${round((cy + ny) / 2)}`
		);
	}
	return `M ${round(startX)} ${round(startY)} Q ${pairs.join(' ')} Z`;
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
	const d = strokePath(outline);
	if (d.length === 0) {
		return '';
	}
	return `<path data-wobble="true" pointer-events="none" d="${d}" fill="${contour.stroke}" fill-opacity="${WOBBLE_OPACITY}"/>`;
}

/** Overlay markup for every contour of an element that shares one seed;
 * contours that cannot produce an outline are skipped individually. */
export function wobbleOverlayGroup(
	seed: number,
	contours: readonly DrawableContour[]
): string {
	return contours.map((contour) => wobbleOverlayMarkup(seed, contour)).join('');
}
