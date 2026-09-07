import type { Direction, Edge, EntityField, Node } from '@kiyora/dsl';
import { formatEntityField, measureLabel } from './label';
import { TEXT_PADDING } from './style';

/** A node box produced by the layered layout. */
export type Box = {
	height: number;
	width: number;
	x: number;
	y: number;
};

/** Options for the dependency-free layered layout. */
export type LayoutOptions = {
	fontSize?: number;
	minHeight?: number;
	minWidth?: number;
	nodeGapX?: number;
	nodeGapY?: number;
	padding?: number;
};

/** The layout result, including the content bounds. */
export type Layout = {
	boxes: Map<string, Box>;
	height: number;
	width: number;
};

const DEFAULTS: Required<LayoutOptions> = {
	fontSize: 16,
	minHeight: 44,
	minWidth: 72,
	nodeGapX: 72,
	nodeGapY: 48,
	padding: 24,
};

const ENTITY_MAX_WIDTH = 320;
const MEMBER_FONT_SIZE_OFFSET = 2;
const KEY_FONT_SIZE_OFFSET = 4;
const KEY_SPACING = 16;
const SECTION_PADDING = 8;

export function measureNode(
	node: Node & {
		fields?: EntityField[];
		methods?: EntityField[];
	},
	options: LayoutOptions = {}
): { height: number; width: number } {
	const opts = { ...DEFAULTS, ...options };

	let naturalWidth = measureLabel(node.label, {
		fontSize: opts.fontSize,
		maxWidth: ENTITY_MAX_WIDTH - TEXT_PADDING * 2,
	}).width;

	let totalHeight = 0;

	if (node.shape === 'entity') {
		const headerMetrics = measureLabel(node.label, {
			fontSize: opts.fontSize,
			maxWidth: ENTITY_MAX_WIDTH - TEXT_PADDING * 2,
		});
		naturalWidth = Math.max(naturalWidth, headerMetrics.width);
		totalHeight += headerMetrics.height + TEXT_PADDING;

		if (node.fields) {
			for (const field of node.fields) {
				const text = formatEntityField(field);
				const memberMetrics = measureLabel(text, {
					fontSize: opts.fontSize - MEMBER_FONT_SIZE_OFFSET,
					maxWidth: ENTITY_MAX_WIDTH,
				});
				let fieldWidth = memberMetrics.width;
				if (field.key) {
					fieldWidth +=
						measureLabel(field.key.toUpperCase(), {
							fontSize: opts.fontSize - KEY_FONT_SIZE_OFFSET,
							maxWidth: ENTITY_MAX_WIDTH,
						}).width + KEY_SPACING;
				}
				naturalWidth = Math.max(naturalWidth, fieldWidth);
				totalHeight += memberMetrics.height;
			}
			if (node.fields.length > 0) {
				totalHeight += SECTION_PADDING;
			}
		}

		if (node.methods) {
			for (const method of node.methods) {
				const text = formatEntityField(method);
				const methodMetrics = measureLabel(text, {
					fontSize: opts.fontSize - MEMBER_FONT_SIZE_OFFSET,
					maxWidth: ENTITY_MAX_WIDTH,
				});
				naturalWidth = Math.max(naturalWidth, methodMetrics.width);
				totalHeight += methodMetrics.height;
			}
			if (node.methods.length > 0) {
				totalHeight += SECTION_PADDING;
			}
		}
	} else {
		totalHeight = measureLabel(node.label, {
			fontSize: opts.fontSize,
			maxWidth: Math.max(
				1,
				Math.max(opts.minWidth - TEXT_PADDING * 2, naturalWidth)
			),
		}).height;
	}

	const contentWidth = Math.max(opts.minWidth - TEXT_PADDING * 2, naturalWidth);

	return {
		height: Math.max(opts.minHeight, totalHeight),
		width: Math.max(opts.minWidth, contentWidth + TEXT_PADDING * 2),
	};
}

function addEdge(
	adjacency: Map<string, string[]>,
	predecessors: Map<string, string[]>,
	edge: Edge
): void {
	if (
		edge.from === edge.to ||
		!adjacency.has(edge.from) ||
		!adjacency.has(edge.to)
	) {
		return;
	}
	const successors = adjacency.get(edge.from);
	const incoming = predecessors.get(edge.to);
	if (!(successors && incoming) || successors.includes(edge.to)) {
		return;
	}
	successors.push(edge.to);
	incoming.push(edge.from);
}

function nodeDepths(
	nodes: readonly Node[],
	predecessors: Map<string, string[]>
): Map<string, number> {
	const depths = new Map<string, number>();
	const visiting = new Set<string>();
	const visit = (id: string): number => {
		const known = depths.get(id);
		if (known !== undefined) {
			return known;
		}
		if (visiting.has(id)) {
			return 0;
		}
		visiting.add(id);
		let depth = 0;
		for (const predecessor of predecessors.get(id) ?? []) {
			depth = Math.max(depth, visit(predecessor) + 1);
		}
		visiting.delete(id);
		depths.set(id, depth);
		return depth;
	};
	for (const node of nodes) {
		visit(node.id);
	}
	return depths;
}

function makeRanks(
	nodes: readonly Node[],
	depths: Map<string, number>
): Map<number, string[]> {
	const ranks = new Map<number, string[]>();
	for (const node of nodes) {
		const rank = depths.get(node.id) ?? 0;
		const ids = ranks.get(rank);
		if (ids) {
			ids.push(node.id);
		} else {
			ranks.set(rank, [node.id]);
		}
	}
	return ranks;
}

function orderRanks(
	ranks: Map<number, string[]>,
	predecessors: Map<string, string[]>
): Map<string, number> {
	const order = new Map<string, number>();
	const maxRank = Math.max(0, ...ranks.keys());
	for (let rank = 0; rank <= maxRank; rank += 1) {
		const ids = ranks.get(rank) ?? [];
		const scored = ids.map((id, sourceIndex) => {
			const incoming = predecessors.get(id) ?? [];
			const positions = incoming
				.map((predecessor) => order.get(predecessor))
				.filter((position): position is number => position !== undefined);
			const barycenter = positions.length
				? positions.reduce((sum, position) => sum + position, 0) /
					positions.length
				: sourceIndex;
			return { barycenter, id, sourceIndex };
		});
		scored.sort(
			(left, right) =>
				left.barycenter - right.barycenter ||
				left.sourceIndex - right.sourceIndex
		);
		for (const [index, item] of scored.entries()) {
			order.set(item.id, index);
		}
	}
	return order;
}

/**
 * Compute deterministic longest-path ranks and place nodes in layers.
 *
 * Membership in groups has no effect on this function. Invalid and self edges
 * are ignored, and the recursion guard makes cyclic input total.
 */
export function layoutGraph(
	nodes: readonly Node[],
	edges: readonly Edge[],
	direction: Direction = 'right',
	options: LayoutOptions = {}
): Layout {
	const opts = { ...DEFAULTS, ...options };
	const sizes = new Map<string, { height: number; width: number }>();
	const adjacency = new Map<string, string[]>();
	const predecessors = new Map<string, string[]>();
	for (const node of nodes) {
		sizes.set(node.id, measureNode(node, opts));
		adjacency.set(node.id, []);
		predecessors.set(node.id, []);
	}
	for (const edge of edges) {
		addEdge(adjacency, predecessors, edge);
	}

	const depths = nodeDepths(nodes, predecessors);
	const ranks = makeRanks(nodes, depths);
	const order = orderRanks(ranks, predecessors);
	const maxRank = Math.max(0, ...ranks.keys());
	const horizontal = direction !== 'down' && direction !== 'up';
	const reverse = direction === 'left' || direction === 'up';
	const rankWidths = new Map<number, number>();
	const rankHeights = new Map<number, number>();
	for (let rank = 0; rank <= maxRank; rank += 1) {
		let width = 0;
		let height = 0;
		for (const id of ranks.get(rank) ?? []) {
			const size = sizes.get(id);
			if (!size) {
				continue;
			}
			width = Math.max(width, size.width);
			height = Math.max(height, size.height);
		}
		rankWidths.set(rank, width);
		rankHeights.set(rank, height);
	}

	const mainGap = horizontal ? opts.nodeGapX : opts.nodeGapY;
	const crossGap = horizontal ? opts.nodeGapY : opts.nodeGapX;
	const mainOffsets = new Map<number, number>();
	let mainSize = 0;
	for (let rank = 0; rank <= maxRank; rank += 1) {
		mainOffsets.set(rank, mainSize);
		mainSize +=
			(horizontal ? rankWidths.get(rank) : rankHeights.get(rank)) ?? 0;
		if (rank < maxRank) {
			mainSize += mainGap;
		}
	}

	const boxes = new Map<string, Box>();
	for (let rank = 0; rank <= maxRank; rank += 1) {
		const ids = [...(ranks.get(rank) ?? [])].sort(
			(left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0)
		);
		let cross = 0;
		for (const id of ids) {
			const size = sizes.get(id);
			if (!size) {
				continue;
			}
			const main = mainOffsets.get(rank) ?? 0;
			const position = reverse
				? mainSize - main - (horizontal ? size.width : size.height)
				: main;
			boxes.set(id, {
				height: size.height,
				width: size.width,
				x: horizontal ? position : cross,
				y: horizontal ? cross : position,
			});
			cross += (horizontal ? size.height : size.width) + crossGap;
		}
	}

	const { padding } = opts;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	for (const box of boxes.values()) {
		minX = Math.min(minX, box.x);
		minY = Math.min(minY, box.y);
	}
	if (!Number.isFinite(minX)) {
		return { boxes, height: padding * 2, width: padding * 2 };
	}
	for (const box of boxes.values()) {
		box.x += padding - minX;
		box.y += padding - minY;
	}
	let width = 0;
	let height = 0;
	for (const box of boxes.values()) {
		width = Math.max(width, box.x + box.width);
		height = Math.max(height, box.y + box.height);
	}
	return {
		boxes,
		height: Math.max(1, height + padding),
		width: Math.max(1, width + padding),
	};
}

/** Short alias for consumers that prefer the module name as the operation. */
export const layout = layoutGraph;
