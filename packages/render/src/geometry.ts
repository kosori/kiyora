export type Box = { height: number; width: number; x: number; y: number };
export type Point = { x: number; y: number };

/** A cubic connector between two box borders, in structured form so clean
 * markup and wobble contours share one source of geometry. */
export type EdgeCubic = {
	c1: Point;
	c2: Point;
	end: Point;
	start: Point;
};

/** Where a ray from a box centre toward a point crosses that box's border. */
export function intersectRect(box: Box, toward: Point): Point {
	const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	const dx = toward.x - center.x;
	const dy = toward.y - center.y;
	if (dx === 0 && dy === 0) {
		return center;
	}
	const halfWidth = box.width / 2;
	const halfHeight = box.height / 2;
	const scale = Math.min(
		dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
		dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy)
	);
	return { x: center.x + dx * scale, y: center.y + dy * scale };
}

/** Border-to-border cubic control points for the connector between two boxes. */
export function edgeCubic(from: Box, to: Box): EdgeCubic {
	const fromCenter = {
		x: from.x + from.width / 2,
		y: from.y + from.height / 2,
	};
	const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
	const start = intersectRect(from, toCenter);
	const end = intersectRect(to, fromCenter);
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (Math.abs(dx) >= Math.abs(dy)) {
		return {
			c1: { x: start.x + dx * 0.4, y: start.y },
			c2: { x: end.x - dx * 0.4, y: end.y },
			end,
			start,
		};
	}
	return {
		c1: { x: start.x, y: start.y + dy * 0.4 },
		c2: { x: end.x, y: end.y - dy * 0.4 },
		end,
		start,
	};
}

/** Serialize an edge cubic as an SVG path `d` attribute. */
export function edgeCubicPathD(cubic: EdgeCubic): string {
	const { c1, c2, end, start } = cubic;
	return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

/** Build a cubic path from the border of one box to the border of another. */
export function edgePathD(from: Box, to: Box): string {
	return edgeCubicPathD(edgeCubic(from, to));
}
