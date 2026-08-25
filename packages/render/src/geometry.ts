export type Box = { height: number; width: number; x: number; y: number };
export type Point = { x: number; y: number };

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

/** Build a cubic path from the border of one box to the border of another. */
export function edgePathD(from: Box, to: Box): string {
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
		const c1x = start.x + dx * 0.4;
		const c2x = end.x - dx * 0.4;
		return `M ${start.x} ${start.y} C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`;
	}
	const c1y = start.y + dy * 0.4;
	const c2y = end.y - dy * 0.4;
	return `M ${start.x} ${start.y} C ${start.x} ${c1y}, ${end.x} ${c2y}, ${end.x} ${end.y}`;
}
