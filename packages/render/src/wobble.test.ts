import { describe, expect, test } from 'bun:test';
import {
	type DrawableContour,
	deriveWobbleSeed,
	sampleCubic,
	sampleEllipse,
	samplePolygon,
	sampleRoundedRect,
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
});
