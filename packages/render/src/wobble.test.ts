import { describe, expect, test } from 'bun:test';
import {
	type DrawableContour,
	deriveWobbleSeed,
	sampleCubic,
	sampleEllipse,
	samplePolygon,
	samplePolyline,
	sampleRoundedRect,
	sampleSegments,
	wobbleOverlayDashedMarkup,
	wobbleOverlayGroup,
	wobbleOverlayMarkup,
} from './wobble';

function closedRectContour(): DrawableContour {
	return {
		closed: true,
		points: sampleRoundedRect({ height: 60, width: 100, x: 10, y: 20 }, 8),
		stroke: '#1e1e1e',
		strokeWidth: 2,
	};
}

function openLineContour(): DrawableContour {
	return {
		closed: false,
		points: [
			[10, 20],
			[50, 24],
			[90, 20],
		],
		stroke: '#4dabf7',
		strokeWidth: 2.5,
	};
}

describe('wobble seeds', () => {
	test('identical identity and geometry produce identical seeds', () => {
		const a = deriveWobbleSeed('node:a', ['rectangle', 100, 44]);
		const b = deriveWobbleSeed('node:a', ['rectangle', 100, 44]);
		expect(a).toBe(b);
	});

	test('distinct identities produce distinct seeds for identical geometry', () => {
		const a = deriveWobbleSeed('node:a', [100, 44]);
		const b = deriveWobbleSeed('node:b', [100, 44]);
		expect(a).not.toBe(b);
	});

	test('moved or resized geometry produces a distinct seed', () => {
		const base = deriveWobbleSeed('node:a', [10, 20, 100, 44]);
		expect(deriveWobbleSeed('node:a', [12, 20, 100, 44])).not.toBe(base);
		expect(deriveWobbleSeed('node:a', [10, 20, 120, 44])).not.toBe(base);
	});

	test('seeds are positive integers below 2^31', () => {
		const seed = deriveWobbleSeed('node:a', ['cylinder']);
		expect(Number.isInteger(seed)).toBe(true);
		expect(seed).toBeGreaterThanOrEqual(0);
		expect(seed).toBeLessThan(2 ** 31);
	});
});

describe('wobble sampling', () => {
	test('rounded rectangle sampling closes the ring and stays dense', () => {
		const points = sampleRoundedRect(
			{ height: 60, width: 100, x: 10, y: 20 },
			12
		);
		expect(points.length).toBeGreaterThan(16);
		expect(points[0]).toEqual(points.at(-1));
		let maxGap = 0;
		for (let i = 1; i < points.length; i += 1) {
			const previous = points[i - 1];
			const current = points[i];
			if (!(previous && current)) {
				continue;
			}
			maxGap = Math.max(
				maxGap,
				Math.hypot(current[0] - previous[0], current[1] - previous[1])
			);
		}
		expect(maxGap).toBeLessThanOrEqual(6);
	});

	test('rounded rectangle with zero radius samples the four corners', () => {
		const points = sampleRoundedRect({ height: 40, width: 80, x: 0, y: 0 }, 0);
		expect(points).toContainEqual([0, 0]);
		expect(points).toContainEqual([80, 0]);
		expect(points).toContainEqual([80, 40]);
		expect(points).toContainEqual([0, 40]);
	});

	test('polygon sampling closes the ring deterministically', () => {
		const diamond: [number, number][] = [
			[50, 0],
			[100, 30],
			[50, 60],
			[0, 30],
		];
		const ring = samplePolygon(diamond);
		expect(ring[0]).toEqual(ring.at(-1));
		expect(ring.length).toBeGreaterThan(diamond.length + 1);
		expect(samplePolygon(diamond)).toEqual(ring);
	});

	test('ellipse sampling stays bounded by the radii and closes the ring', () => {
		const points = sampleEllipse(60, 50, 50, 30);
		expect(points[0]).toEqual(points.at(-1));
		for (const [x, y] of points) {
			expect(x).toBeGreaterThanOrEqual(10 - 0.001);
			expect(x).toBeLessThanOrEqual(110 + 0.001);
			expect(y).toBeGreaterThanOrEqual(20 - 0.001);
			expect(y).toBeLessThanOrEqual(80 + 0.001);
		}
		expect(points.length).toBeGreaterThanOrEqual(48);
	});

	test('cubic sampling is open and starts/ends on the anchors', () => {
		const points = sampleCubic([0, 0], [40, 0], [60, 60], [100, 60]);
		expect(points[0]).toEqual([0, 0]);
		expect(points.at(-1)).toEqual([100, 60]);
		expect(points.length).toBeGreaterThanOrEqual(8);
	});

	test('polyline sampling is open and keeps its endpoints', () => {
		const points = samplePolyline([
			[0, 0],
			[10, 5],
			[20, 0],
		]);
		expect(points[0]).toEqual([0, 0]);
		expect(points.at(-1)).toEqual([20, 0]);
		expect(points.length).toBeGreaterThan(3);
	});

	test('arc sampling honors the sweep direction', () => {
		const clockwise = sampleSegments(
			[
				{
					from: [0, 0],
					rx: 5,
					ry: 5,
					sweep: true,
					to: [10, 0],
					type: 'arc',
				},
			],
			false
		);
		for (const [, y] of clockwise) {
			expect(y).toBeLessThanOrEqual(0.001);
		}
		const counterClockwise = sampleSegments(
			[
				{
					from: [0, 0],
					rx: 5,
					ry: 5,
					sweep: false,
					to: [10, 0],
					type: 'arc',
				},
			],
			false
		);
		for (const [, y] of counterClockwise) {
			expect(y).toBeGreaterThanOrEqual(-0.001);
		}
	});

	test('arc sampling endpoints match the anchors and too-small radii scale up', () => {
		const points = sampleSegments(
			[
				{
					from: [0, 0],
					rx: 5,
					ry: 5,
					sweep: true,
					to: [40, 0],
					type: 'arc',
				},
			],
			false
		);
		expect(points[0]).toEqual([0, 0]);
		expect(points.at(-1)).toEqual([40, 0]);
		expect(points.length).toBeGreaterThan(8);
	});

	test('segment sampling chains lines, cubics, and arcs without duplicates', () => {
		const points = sampleSegments(
			[
				{ from: [0, 0], to: [20, 0], type: 'line' },
				{
					c1: [30, 0],
					c2: [40, 10],
					from: [20, 0],
					to: [40, 20],
					type: 'cubic',
				},
			],
			true
		);
		expect(points[0]).toEqual([0, 0]);
		expect(points.at(-1)).toEqual([0, 0]);
		const joins = points.filter(([x, y]) => x === 20 && y === 0);
		expect(joins.length).toBe(1);
		let maxGap = 0;
		for (let i = 1; i < points.length; i += 1) {
			const previous = points[i - 1];
			const current = points[i];
			if (!(previous && current)) {
				continue;
			}
			maxGap = Math.max(
				maxGap,
				Math.hypot(current[0] - previous[0], current[1] - previous[1])
			);
		}
		expect(maxGap).toBeLessThanOrEqual(6);
	});

	test('sampling is stable for identical input', () => {
		expect(
			sampleRoundedRect({ height: 60, width: 100, x: 10, y: 20 }, 12)
		).toEqual(sampleRoundedRect({ height: 60, width: 100, x: 10, y: 20 }, 12));
	});
});

describe('wobble overlay generation', () => {
	test('renders a filled, pointer-transparent overlay path for closed contours', () => {
		const markup = wobbleOverlayMarkup(42, closedRectContour());
		expect(markup).toStartWith('<path data-wobble="true"');
		expect(markup).toContain('pointer-events="none"');
		expect(markup).toContain('fill="#1e1e1e"');
		expect(markup).toContain('fill-opacity=');
		expect(markup).not.toContain('stroke=');
		expect(markup).toMatch(/d="M [^"]+ Z"/);
	});

	test('renders an overlay for open contours', () => {
		const markup = wobbleOverlayMarkup(7, openLineContour());
		expect(markup).toContain('data-wobble="true"');
		expect(markup).toContain('fill="#4dabf7"');
	});

	test('output is deterministic for identical seed and contour', () => {
		const seed = deriveWobbleSeed('node:a', [10, 20, 100, 60]);
		expect(wobbleOverlayMarkup(seed, closedRectContour())).toBe(
			wobbleOverlayMarkup(seed, closedRectContour())
		);
	});

	test('distinct seeds produce distinct overlay geometry', () => {
		const a = wobbleOverlayMarkup(1, closedRectContour());
		const b = wobbleOverlayMarkup(2, closedRectContour());
		expect(a).not.toBe(b);
	});

	test('degenerate contours without usable points return no markup', () => {
		expect(wobbleOverlayMarkup(1, { ...openLineContour(), points: [] })).toBe(
			''
		);
		expect(
			wobbleOverlayMarkup(1, {
				...openLineContour(),
				points: [
					[Number.NaN, 0],
					[10, Number.POSITIVE_INFINITY],
				],
			})
		).toBe('');
	});

	test('group markup concatenates every component overlay and skips failures', () => {
		const group = wobbleOverlayGroup(3, [
			closedRectContour(),
			{ ...openLineContour(), points: [] },
			openLineContour(),
		]);
		expect(group.match(/data-wobble="true"/g)?.length).toBe(2);
	});

	describe('dashed overlays', () => {
		const denseLine = (): DrawableContour => ({
			closed: false,
			points: samplePolyline([
				[0, 0],
				[100, 0],
			]),
			stroke: '#1e1e1e',
			strokeWidth: 2.5,
		});

		test('a dashed contour produces one overlay run per dash', () => {
			const markup = wobbleOverlayDashedMarkup(11, denseLine(), 4.5, 6);
			const runs = markup.match(/data-wobble="true"/g)?.length ?? 0;
			expect(runs).toBe(10);
			expect(wobbleOverlayMarkup(11, denseLine())).not.toBe(markup);
		});

		test('dashed overlay output is deterministic and seed-sensitive', () => {
			expect(wobbleOverlayDashedMarkup(5, denseLine(), 4.5, 6)).toBe(
				wobbleOverlayDashedMarkup(5, denseLine(), 4.5, 6)
			);
			expect(wobbleOverlayDashedMarkup(5, denseLine(), 4.5, 6)).not.toBe(
				wobbleOverlayDashedMarkup(6, denseLine(), 4.5, 6)
			);
		});

		test('non-positive dash metrics fall back to one continuous run', () => {
			expect(wobbleOverlayDashedMarkup(2, denseLine(), 0, 6)).toBe(
				wobbleOverlayMarkup(2, denseLine())
			);
		});

		test('runs are distinct so repeated dashes do not look stamped', () => {
			const markup = wobbleOverlayDashedMarkup(9, denseLine(), 4.5, 6);
			const ds = [...markup.matchAll(/d="([^"]+)"/g)].map((match) => match[1]);
			expect(new Set(ds).size).toBe(ds.length);
		});

		const squareRing = (side: number): DrawableContour => ({
			closed: true,
			points: samplePolygon([
				[0, 0],
				[side, 0],
				[side, side],
				[0, side],
			]),
			stroke: '#868e96',
			strokeWidth: 1.5,
		});

		test('a closed ring tiles its dashes so the seam keeps a gap', () => {
			// Perimeter 400 with a 12-unit cycle leaves a 4-unit truncated dash
			// flush against the ring start; cyclic tiling must keep 33 evenly
			// spaced runs instead of 34 with a seam blob.
			const ring = squareRing(100);
			const markup = wobbleOverlayDashedMarkup(4, ring, 6, 6);
			expect(markup.match(/data-wobble="true"/g)?.length).toBe(33);
		});

		test('a closed ring with a cycle that divides the perimeter tiles exactly', () => {
			const ring = squareRing(100);
			const markup = wobbleOverlayDashedMarkup(4, ring, 6, 4);
			expect(markup.match(/data-wobble="true"/g)?.length).toBe(40);
		});

		test('closed ring dashed output is deterministic and seed-sensitive', () => {
			expect(wobbleOverlayDashedMarkup(7, squareRing(80), 6, 6)).toBe(
				wobbleOverlayDashedMarkup(7, squareRing(80), 6, 6)
			);
			expect(wobbleOverlayDashedMarkup(7, squareRing(80), 6, 6)).not.toBe(
				wobbleOverlayDashedMarkup(8, squareRing(80), 6, 6)
			);
		});

		test('closed rings keep every band open with rounded freehand ends', () => {
			const markup = wobbleOverlayDashedMarkup(2, squareRing(60), 6, 6);
			const ds = [...markup.matchAll(/d="([^"]+)"/g)]
				.map((match) => match[1])
				.filter((d) => d !== undefined);
			expect(ds.length).toBeGreaterThan(5);
			for (const d of ds) {
				expect(d).toStartWith('M');
				expect(d).toEndWith(' Z');
			}
		});
	});
});
