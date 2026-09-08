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

export type MeasuredBranch = {
	branch: MindMapBranch;
	children: MeasuredBranch[];
	childrenHeight: number;
	height: number;
	subtreeHeight: number;
	subtreeWidth: number;
	width: number;
};

type LayoutContext = {
	boxes: Map<string, Box>;
	opts: Required<LayoutOptions>;
};

export function measureBranch(
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
	let maxChildSubtreeWidth = 0;
	for (const child of children) {
		totalChildHeights += child.subtreeHeight;
		maxChildSubtreeWidth = Math.max(maxChildSubtreeWidth, child.subtreeWidth);
	}

	const childrenHeight =
		children.length > 0
			? totalChildHeights + (children.length - 1) * opts.nodeGapY
			: 0;
	const subtreeHeight = Math.max(height, childrenHeight);
	const subtreeWidth =
		children.length > 0 ? width + opts.nodeGapX + maxChildSubtreeWidth : width;

	return {
		branch,
		children,
		childrenHeight,
		height,
		subtreeHeight,
		subtreeWidth,
		width,
	};
}

function positionBranch(
	measured: MeasuredBranch,
	x: number,
	yIntervalStart: number,
	ctx: LayoutContext
): void {
	const { boxes, opts } = ctx;
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
		positionBranch(child, childX, currentY, ctx);
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

	const ctx: LayoutContext = {
		boxes: new Map<string, Box>(),
		opts,
	};
	positionBranch(measured, opts.padding, opts.padding, ctx);

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	for (const box of ctx.boxes.values()) {
		minX = Math.min(minX, box.x);
		minY = Math.min(minY, box.y);
	}

	if (!Number.isFinite(minX)) {
		return {
			boxes: ctx.boxes,
			height: opts.padding * 2,
			width: opts.padding * 2,
		};
	}

	for (const box of ctx.boxes.values()) {
		box.x += opts.padding - minX;
		box.y += opts.padding - minY;
	}

	let width = 0;
	let height = 0;
	for (const box of ctx.boxes.values()) {
		width = Math.max(width, box.x + box.width);
		height = Math.max(height, box.y + box.height);
	}

	return {
		boxes: ctx.boxes,
		height: Math.max(1, height + opts.padding),
		width: Math.max(1, width + opts.padding),
	};
}
