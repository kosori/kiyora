import type { SceneNode } from '@kiyora/render';
import type { Point, Viewport } from './viewport';
import { worldToScreen } from './viewport';

/** The eight directional resize handles around a selected node. */
export type ResizeHandle = 'e' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w';

export const RESIZE_HANDLES: readonly ResizeHandle[] = [
	'nw',
	'n',
	'ne',
	'e',
	'se',
	's',
	'sw',
	'w',
];

/** A resized node may not collapse below this box. */
export const MIN_NODE_WIDTH = 40;
export const MIN_NODE_HEIGHT = 24;

/** The side length of a handle square, in screen pixels. */
export const HANDLE_SIZE = 8;

/** The gap between a node box and its selection outline, in screen pixels. */
export const SELECTION_OUTSET = 3;

type Box = { height: number; width: number; x: number; y: number };

/**
 * Resize a box by dragging the corner or edge named by `handle` to `point`,
 * keeping the opposite corner or edge fixed and clamping to the minimum size.
 */
export function resizeBox(box: Box, handle: ResizeHandle, point: Point): Box {
	const right = box.x + box.width;
	const bottom = box.y + box.height;
	let { x, y, width, height } = box;
	if (handle.includes('w')) {
		x = Math.min(point.x, right - MIN_NODE_WIDTH);
		width = right - x;
	} else if (handle.includes('e')) {
		width = Math.max(point.x - box.x, MIN_NODE_WIDTH);
	}
	if (handle.includes('n')) {
		y = Math.min(point.y, bottom - MIN_NODE_HEIGHT);
		height = bottom - y;
	} else if (handle.includes('s')) {
		height = Math.max(point.y - box.y, MIN_NODE_HEIGHT);
	}
	return { height, width, x, y };
}

/** The unit direction from a box center toward `handle`. */
function handleOffset(handle: ResizeHandle): { dx: number; dy: number } {
	return {
		dx: handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0,
		dy: handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0,
	};
}

/**
 * The screen-space center of `handle` for a node, sitting on the selection
 * outline so the chrome the renderer paints and the chrome input hit-tests
 * never drift apart.
 */
export function handleScreenCenter(
	viewport: Viewport,
	node: Pick<SceneNode, 'height' | 'width' | 'x' | 'y'>,
	handle: ResizeHandle
): Point {
	const topLeft = worldToScreen(viewport, node);
	const bottomRight = worldToScreen(viewport, {
		x: node.x + node.width,
		y: node.y + node.height,
	});
	const { dx, dy } = handleOffset(handle);
	const center = {
		x: (topLeft.x + bottomRight.x) / 2,
		y: (topLeft.y + bottomRight.y) / 2,
	};
	return {
		x:
			dx === 0
				? center.x
				: dx < 0
					? topLeft.x - SELECTION_OUTSET
					: bottomRight.x + SELECTION_OUTSET,
		y:
			dy === 0
				? center.y
				: dy < 0
					? topLeft.y - SELECTION_OUTSET
					: bottomRight.y + SELECTION_OUTSET,
	};
}

/** Return whether a screen-space point sits on the node's `handle`. */
export function handleHit(
	viewport: Viewport,
	node: Pick<SceneNode, 'height' | 'width' | 'x' | 'y'>,
	handle: ResizeHandle,
	point: Point,
	half = HANDLE_SIZE / 2
): boolean {
	const center = handleScreenCenter(viewport, node, handle);
	return (
		Math.abs(point.x - center.x) <= half && Math.abs(point.y - center.y) <= half
	);
}

/**
 * Resolve the sole selected node from a node index, or null when the selection
 * is empty or holds more than one node. Resize chrome only exists for a single
 * selection.
 */
export function singleSelectedNode(
	nodeIndex: Map<string, SceneNode>,
	selection: readonly string[]
): SceneNode | null {
	if (selection.length !== 1) {
		return null;
	}
	const [selectedId] = selection;
	return selectedId ? (nodeIndex.get(selectedId) ?? null) : null;
}
