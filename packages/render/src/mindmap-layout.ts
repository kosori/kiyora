import type { MindMapBranch, MindMapDiagram } from '@kiyora/dsl';
import {
	type Box,
	type Layout,
	type LayoutOptions,
	measureNode,
} from './layout';

const DEFAULTS: Required<LayoutOptions> = {
	fontSize: 16,
	minHeight: 44,
	minWidth: 72,
	nodeGapX: 72,
	nodeGapY: 48,
	padding: 24,
};

type MeasuredBranch = {
	branch: MindMapBranch;
	children: MeasuredBranch[];
	childrenHeight: number;
	height: number;
	subtreeHeight: number;
	width: number;
};

function measureBranch(
	branch: MindMapBranch,
	opts: Required<LayoutOptions>
): MeasuredBranch {
	const { height, width } = measureNode(
		{
			id: branch.id,
			label: branch.label,
			span: branch.span,
		},
		opts
	);

	const children: MeasuredBranch[] = [];
	for (const child of branch.children) {
		children.push(measureBranch(child, opts));
	}

	let totalChildHeights = 0;
	for (const child of children) {
		totalChildHeights += child.subtreeHeight;
	}

	const childrenHeight =
		children.length > 0
			? totalChildHeights + (children.length - 1) * opts.nodeGapY
			: 0;
	const subtreeHeight = Math.max(height, childrenHeight);

	return {
		branch,
		children,
		childrenHeight,
		height,
		subtreeHeight,
		width,
	};
}

function positionBranch(
	measured: MeasuredBranch,
	x: number,
	yIntervalStart: number,
	opts: Required<LayoutOptions>,
	boxes: Map<string, Box>
): void {
	const nodeY = yIntervalStart + (measured.subtreeHeight - measured.height) / 2;
	boxes.set(measured.branch.id, {
		height: measured.height,
		width: measured.width,
		x,
		y: nodeY,
	});

	if (measured.children.length === 0) {
		return;
	}

	const childrenStartY =
		yIntervalStart + (measured.subtreeHeight - measured.childrenHeight) / 2;
	const childX = x + measured.width + opts.nodeGapX;

	let currentY = childrenStartY;
	for (const child of measured.children) {
		positionBranch(child, childX, currentY, opts, boxes);
		currentY += child.subtreeHeight + opts.nodeGapY;
	}
}

/** Lay out a mindmap diagram as a horizontal tree. */
export function layoutMindmap(
	diagram: MindMapDiagram,
	options: LayoutOptions = {}
): Layout {
	const opts = { ...DEFAULTS, ...options };
	const measured = measureBranch(diagram.root, opts);

	const boxes = new Map<string, Box>();
	positionBranch(measured, opts.padding, opts.padding, opts, boxes);

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	for (const box of boxes.values()) {
		minX = Math.min(minX, box.x);
		minY = Math.min(minY, box.y);
	}

	if (!Number.isFinite(minX)) {
		return { boxes, height: opts.padding * 2, width: opts.padding * 2 };
	}

	for (const box of boxes.values()) {
		box.x += opts.padding - minX;
		box.y += opts.padding - minY;
	}

	let width = 0;
	let height = 0;
	for (const box of boxes.values()) {
		width = Math.max(width, box.x + box.width);
		height = Math.max(height, box.y + box.height);
	}

	return {
		boxes,
		height: Math.max(1, height + opts.padding),
		width: Math.max(1, width + opts.padding),
	};
}
