import {
	type Scene,
	type SceneEdge,
	type SceneNode,
	scenePlacement,
} from '@kiyora/render';
import type { ResizeHandle } from './resize';
import {
	handleHit,
	handleWorldPoint,
	RESIZE_HANDLES,
	resizeBox,
	singleSelectedNode,
} from './resize';
import { SNAP_STEP, selectionAnchor, snapDragDelta } from './snap';
import type { Bounds, Point, Viewport } from './viewport';
import {
	fitToBounds as fitViewportToBounds,
	panBy as panViewportBy,
	resetView as resetViewport,
	screenToWorld,
	zoomAt as zoomViewportAt,
} from './viewport';

/** A marquee rectangle in screen-space pixels while it is being dragged. */
export type MarqueeRect = {
	x1: number;
	x2: number;
	y1: number;
	y2: number;
};

/** A screen-space resize target: the node and the handle under a point. */
export type ResizeTarget = {
	handle: ResizeHandle;
	id: string;
};

/** An arrow-key nudge direction. */
export type NudgeDirection = 'down' | 'left' | 'right' | 'up';

/** The immutable state exposed by an Editor. */
export type EditorSnapshot = {
	marquee: MarqueeRect | null;
	scene: Scene;
	selection: readonly string[];
	viewport: Viewport;
};

/** Framework-agnostic canvas state API. */
export type Editor = {
	readonly canRedo: boolean;
	readonly canUndo: boolean;
	readonly readOnly: boolean;
	beginDrag: (id: string) => void;

	/** Start a screen-space marquee rectangle anchored at `point`. */
	beginMarquee: (point: Point) => void;
	/** Start a keyboard nudge run for the current selection. */
	beginNudge: () => void;
	/** Start resizing node `id` by dragging its `handle` (world space). */
	beginResize: (id: string, handle: ResizeHandle) => void;
	/** Discard the active marquee without changing the selection. */
	cancelMarquee: () => void;
	/** Abandon the active resize gesture: restore the pre-gesture Scene and
	 * record no History entry. */
	cancelResize: () => void;
	copy: () => void;
	cut: () => void;
	deleteSelection: () => void;
	/** Move the dragged selection by a screen-space delta in pixels, snapping
	 * its anchor onto the always-on 8-px grid. */
	drag: (dx: number, dy: number) => void;
	duplicate: () => void;
	endDrag: () => void;
	/** End the active marquee, selecting intersecting nodes; `addToSelection`
	 * merges into the current selection instead of replacing it. */
	endMarquee: (addToSelection: boolean) => void;
	/** End the active nudge run, committing one History entry. */
	endNudge: () => void;
	/** End the active resize gesture, committing one History entry. */
	endResize: () => void;
	fitToBounds: (
		bounds: Bounds,
		size: { height: number; width: number }
	) => void;
	getScene: () => Scene;
	getSelection: () => readonly string[];
	getSnapshot: () => EditorSnapshot;
	getViewport: () => Viewport;
	hitTest: (point: Point) => SceneNode | null;
	/** Return the single selected node and handle whose screen-space chrome
	 * contains `point`, or null when no handle is under it. */
	hitTestHandle: (point: Point) => ResizeTarget | null;
	/** Move the free corner of the active marquee to `point`. */
	marqueeTo: (point: Point) => void;
	/** Move the active nudge run's selection by one press: a single world unit,
	 * or a grid step when `byGridStep` is set. */
	nudge: (direction: NudgeDirection, byGridStep: boolean) => void;
	panBy: (dx: number, dy: number) => void;
	paste: () => void;
	resetView: () => void;
	redo: () => void;
	/** Resize the single selected node by one snap-grid step (screen-space
	 * `SNAP_STEP`, converted at the current zoom) toward `direction`, or away
	 * from it when `shrink` is set, clamped to the minimum node size like the
	 * pointer gesture. A run coalesces into one History entry like `nudge`:
	 * the first press opens it and `endResize` closes it. Returns whether a
	 * run is live, so keyboard hosts can decide whether to consume the event. */
	resizeBy: (direction: NudgeDirection, shrink?: boolean) => boolean;
	/** Move the active resize gesture so the dragged corner sits at `point`
	 * (world space), clamped to the minimum node size. */
	resizeTo: (point: Point) => void;
	select: (id: string | null) => void;
	/** Replace the selection with `ids`, dropping unknown and repeated ids. */
	selectMany: (ids: readonly string[]) => void;
	setScene: (scene: Scene) => void;
	setViewport: (viewport: Viewport) => void;
	subscribe: (listener: () => void) => () => void;
	toggleSelect: (id: string) => void;
	undo: () => void;
	zoomAt: (anchor: Point, factor: number) => void;
};

/** Return whether a world-space point is inside a box, including its edges. */
export function boxContains(
	box: Pick<SceneNode, 'height' | 'width' | 'x' | 'y'>,
	point: Point
): boolean {
	return (
		point.x >= box.x &&
		point.x <= box.x + box.width &&
		point.y >= box.y &&
		point.y <= box.y + box.height
	);
}

/** Return whether a world-space rectangle overlaps a box, including edges. */
function boxIntersectsRect(
	box: Pick<SceneNode, 'height' | 'width' | 'x' | 'y'>,
	rect: { x1: number; x2: number; y1: number; y2: number }
): boolean {
	return (
		rect.x1 <= box.x + box.width &&
		rect.x2 >= box.x &&
		rect.y1 <= box.y + box.height &&
		rect.y2 >= box.y
	);
}

/**
 * Move selected nodes without mutating the input Scene.
 *
 * The Scene and its nodes are shallow-copied only where necessary: nodes that
 * are not in `ids` retain their original references.
 */
export function moveNodes(
	scene: Scene,
	ids: readonly string[],
	dx: number,
	dy: number
): Scene {
	const movedIds = new Set(ids);
	return {
		...scene,
		nodes: scene.nodes.map((node) =>
			movedIds.has(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node
		),
	};
}

/**
 * Delete nodes and their incident edges without mutating the input Scene.
 *
 * Nodes that are not deleted retain their original references.
 */
function deleteNodes(scene: Scene, ids: readonly string[]): Scene {
	const deletedIds = new Set(ids);
	return {
		...scene,
		edges: scene.edges.filter(
			(edge) => !(deletedIds.has(edge.from) || deletedIds.has(edge.to))
		),
		nodes: scene.nodes.filter((node) => !deletedIds.has(node.id)),
	};
}

/**
 * Paste a clipboard fragment into a Scene: copies are offset by `dx`/`dy`,
 * receive fresh collision-free ids, and drop group membership because groups
 * are never part of a copy. Internal edges follow their remapped endpoints.
 */
function pasteFragment(
	scene: Scene,
	fragment: ClipboardFragment,
	dx: number,
	dy: number
): Scene {
	const usedIds = new Set(scene.nodes.map((node) => node.id));
	const idMap = new Map<string, string>();
	const added: SceneNode[] = [];
	for (const node of fragment.nodes) {
		const copyId = uniqueCopyId(node.id, usedIds);
		idMap.set(node.id, copyId);
		added.push({
			...node,
			group: undefined,
			id: copyId,
			x: node.x + dx,
			y: node.y + dy,
		});
	}
	const edges: SceneEdge[] = [];
	for (const edge of fragment.edges) {
		const from = idMap.get(edge.from);
		const to = idMap.get(edge.to);
		if (from && to) {
			edges.push({ ...edge, from, to });
		}
	}
	return {
		...scene,
		edges: [...scene.edges, ...edges],
		nodes: [...scene.nodes, ...added],
	};
}

/**
 * Capture the copied nodes and the edges between them. Returns null when the
 * selection matches no nodes so callers can keep the previous clipboard.
 */
function captureFragment(
	scene: Scene,
	ids: readonly string[]
): ClipboardFragment | null {
	const copiedIds = new Set(ids);
	const nodes = scene.nodes.filter((node) => copiedIds.has(node.id));
	if (nodes.length === 0) {
		return null;
	}
	const edges = scene.edges.filter(
		(edge) => copiedIds.has(edge.from) && copiedIds.has(edge.to)
	);
	return { edges, nodes };
}

/**
 * Claim a collision-free copy id against `used`: `name-copy`, `name-copy-2`, …
 * The winning id is added to `used` before it is returned.
 */
function uniqueCopyId(base: string, used: Set<string>): string {
	let id = `${base}-copy`;
	let suffix = 2;
	while (used.has(id)) {
		id = `${base}-copy-${suffix}`;
		suffix += 1;
	}
	used.add(id);
	return id;
}

const HISTORY_LIMIT = 200;

const PASTE_OFFSET = 16;

/** The world-unit distance a plain arrow-key nudge moves the selection. */
const NUDGE_UNIT = 1;

const NUDGE_VECTORS: Record<NudgeDirection, Point> = {
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
	up: { x: 0, y: -1 },
};

const RESIZE_HANDLE_FOR_DIRECTION: Record<NudgeDirection, ResizeHandle> = {
	down: 's',
	left: 'w',
	right: 'e',
	up: 'n',
};

type ClipboardFragment = {
	edges: readonly SceneEdge[];
	nodes: readonly SceneNode[];
};

type DragState = {
	ids: readonly string[];
	before: Scene;
	/** World-space snap anchor: the dragged selection's bounding-box top-left. */
	anchor: Point;
	/** Cumulative raw drag input in screen pixels. */
	totalScreenDx: number;
	totalScreenDy: number;
	/** Cumulative snapped delta applied to the selection so far, in world units. */
	appliedDx: number;
	appliedDy: number;
};

type ResizeState = {
	id: string;
	handle: ResizeHandle;
	before: Scene;
};

type NudgeState = {
	ids: readonly string[];
	before: Scene;
};

function sameViewport(left: Viewport, right: Viewport): boolean {
	return (
		left.zoom === right.zoom && left.tx === right.tx && left.ty === right.ty
	);
}

function sameMarquee(
	left: MarqueeRect | null,
	right: MarqueeRect | null
): boolean {
	if (left === null || right === null) {
		return left === right;
	}
	return (
		left.x1 === right.x1 &&
		left.x2 === right.x2 &&
		left.y1 === right.y1 &&
		left.y2 === right.y2
	);
}

function mergeIds(
	selection: readonly string[],
	incoming: readonly string[]
): string[] {
	const merged = [...selection];
	const seen = new Set(selection);
	for (const id of incoming) {
		if (!seen.has(id)) {
			seen.add(id);
			merged.push(id);
		}
	}
	return merged;
}

/** Create an Editor over an immutable, renderable Scene. */
export function createEditor(initialScene?: Scene): Editor {
	let scene = initialScene ?? {
		edges: [],
		groups: [],
		nodes: [],
		title: '',
	};
	let viewport = initialViewport(scene);
	let selection: readonly string[] = [];
	let marquee: MarqueeRect | null = null;
	let nodeIndex = buildNodeIndex(scene);
	let undoStack: Scene[] = [];
	let redoStack: Scene[] = [];
	let dragState: DragState | null = null;
	let resizeState: ResizeState | null = null;
	let nudgeState: NudgeState | null = null;
	let clipboard: ClipboardFragment | null = null;
	const listeners = new Set<() => void>();

	let snapshot: EditorSnapshot = { marquee, scene, selection, viewport };

	function notify(): void {
		snapshot = { marquee, scene, selection, viewport };
		for (const listener of listeners) {
			listener();
		}
	}

	function setCurrentScene(nextScene: Scene): void {
		if (nextScene === scene) {
			return;
		}
		scene = nextScene;
		nodeIndex = buildNodeIndex(scene);
		notify();
	}

	function setSelection(nextSelection: readonly string[]): void {
		if (sameStrings(selection, nextSelection)) {
			return;
		}
		selection = nextSelection;
		notify();
	}

	function restoreScene(restored: Scene): void {
		dragState = null;
		resizeState = null;
		nudgeState = null;
		setCurrentScene(restored);
	}

	function commitScene(nextScene: Scene): void {
		if (nextScene === scene) {
			return;
		}
		commitNudgeRun();
		pushCapped(undoStack, scene);
		redoStack = [];
		setCurrentScene(nextScene);
	}

	function commitGesture(before: Scene): void {
		if (scene !== before) {
			pushCapped(undoStack, before);
			redoStack = [];
		}
	}

	/** Apply a resized bounding box to a node, skipping no-op geometry. */
	function applyResizeBox(
		node: SceneNode,
		handle: ResizeHandle,
		point: Point
	): void {
		const box = resizeBox(node, handle, point);
		if (
			box.x === node.x &&
			box.y === node.y &&
			box.width === node.width &&
			box.height === node.height
		) {
			return;
		}
		setCurrentScene({
			...scene,
			nodes: scene.nodes.map((candidate) =>
				candidate.id === node.id ? { ...candidate, ...box } : candidate
			),
		});
	}

	/** Drop the active resize state and return its pre-gesture Scene, if any. */
	function clearResizeState(): Scene | null {
		if (!resizeState) {
			return null;
		}
		const { before } = resizeState;
		resizeState = null;
		return before;
	}

	/** End a resize gesture, committing one history entry when the Scene changed. */
	function endResizeGesture(): void {
		const before = clearResizeState();
		if (before) {
			commitGesture(before);
		}
	}

	function commitNudgeRun(): void {
		if (!nudgeState) {
			return;
		}
		const { before } = nudgeState;
		nudgeState = null;
		commitGesture(before);
	}

	function deleteSelectedNodes(): void {
		if (scene.readOnly || selection.length === 0) {
			return;
		}
		commitScene(deleteNodes(scene, selection));
		setSelection([]);
	}

	function commitPaste(fragment: ClipboardFragment): void {
		if (scene.readOnly) {
			return;
		}
		commitScene(pasteFragment(scene, fragment, PASTE_OFFSET, PASTE_OFFSET));
	}

	function setMarquee(nextMarquee: MarqueeRect | null): void {
		if (sameMarquee(marquee, nextMarquee)) {
			return;
		}
		marquee = nextMarquee;
		notify();
	}

	function marqueeWorldRect(): {
		x1: number;
		x2: number;
		y1: number;
		y2: number;
	} | null {
		if (!marquee) {
			return null;
		}
		const corner = screenToWorld(viewport, { x: marquee.x1, y: marquee.y1 });
		const opposite = screenToWorld(viewport, { x: marquee.x2, y: marquee.y2 });
		return {
			x1: Math.min(corner.x, opposite.x),
			x2: Math.max(corner.x, opposite.x),
			y1: Math.min(corner.y, opposite.y),
			y2: Math.max(corner.y, opposite.y),
		};
	}

	const editor: Editor = {
		beginDrag(id) {
			if (scene.readOnly) {
				return;
			}
			const node = nodeIndex.get(id);
			if (!node) {
				return;
			}
			commitNudgeRun();
			endResizeGesture();
			const ids = selection.includes(id)
				? selection.filter((selectedId) => nodeIndex.has(selectedId))
				: [id];
			const dragged: Point[] = [];
			for (const selectedId of ids) {
				const selectedNode = nodeIndex.get(selectedId);
				if (selectedNode) {
					dragged.push({ x: selectedNode.x, y: selectedNode.y });
				}
			}
			dragState = {
				anchor: selectionAnchor(dragged) ?? { x: node.x, y: node.y },
				appliedDx: 0,
				appliedDy: 0,
				before: scene,
				ids,
				totalScreenDx: 0,
				totalScreenDy: 0,
			};
		},
		beginMarquee(point) {
			setMarquee({ x1: point.x, x2: point.x, y1: point.y, y2: point.y });
		},
		beginNudge() {
			if (scene.readOnly || nudgeState) {
				return;
			}
			const ids = selection.filter((selectedId) => nodeIndex.has(selectedId));
			if (ids.length === 0) {
				return;
			}
			nudgeState = { before: scene, ids };
		},
		beginResize(id, handle) {
			if (scene.readOnly) {
				return;
			}
			const node = nodeIndex.get(id);
			if (!(node && RESIZE_HANDLES.includes(handle))) {
				return;
			}
			if (resizeState && resizeState.id === id) {
				resizeState.handle = handle;
				return;
			}
			commitNudgeRun();
			endResizeGesture();
			resizeState = { before: scene, handle, id };
		},
		cancelMarquee() {
			if (marquee) {
				setMarquee(null);
			}
		},
		cancelResize() {
			const before = clearResizeState();
			if (before) {
				setCurrentScene(before);
			}
		},
		get canRedo() {
			return redoStack.length > 0;
		},
		get canUndo() {
			return undoStack.length > 0;
		},
		copy() {
			clipboard = captureFragment(scene, selection) ?? clipboard;
		},
		cut() {
			if (scene.readOnly) {
				return;
			}
			const fragment = captureFragment(scene, selection);
			if (!fragment) {
				return;
			}
			clipboard = fragment;
			deleteSelectedNodes();
		},
		deleteSelection() {
			if (scene.readOnly) {
				return;
			}
			deleteSelectedNodes();
		},
		drag(dx, dy) {
			if (scene.readOnly || !dragState || (dx === 0 && dy === 0)) {
				return;
			}
			const totalScreenDx = dragState.totalScreenDx + dx;
			const totalScreenDy = dragState.totalScreenDy + dy;
			const snapped = snapDragDelta(
				viewport,
				dragState.anchor,
				totalScreenDx,
				totalScreenDy
			);
			const stepDx = snapped.x - dragState.appliedDx;
			const stepDy = snapped.y - dragState.appliedDy;
			dragState = {
				...dragState,
				appliedDx: snapped.x,
				appliedDy: snapped.y,
				totalScreenDx,
				totalScreenDy,
			};
			if (stepDx === 0 && stepDy === 0) {
				return;
			}
			setCurrentScene(moveNodes(scene, dragState.ids, stepDx, stepDy));
		},
		duplicate() {
			if (scene.readOnly) {
				return;
			}
			const fragment = captureFragment(scene, selection);
			if (!fragment) {
				return;
			}
			commitPaste(fragment);
		},
		endDrag() {
			if (!dragState) {
				return;
			}
			const { before } = dragState;
			dragState = null;
			commitGesture(before);
		},
		endMarquee(addToSelection) {
			const rect = marqueeWorldRect();
			if (!rect) {
				return;
			}
			const hitIds: string[] = [];
			for (const node of scene.nodes) {
				if (boxIntersectsRect(node, rect)) {
					hitIds.push(node.id);
				}
			}
			const nextSelection = addToSelection
				? mergeIds(selection, hitIds)
				: hitIds;
			marquee = null;
			selection = nextSelection;
			notify();
		},
		endNudge() {
			commitNudgeRun();
		},
		endResize() {
			endResizeGesture();
		},
		fitToBounds(bounds, size) {
			setViewport(fitViewportToBounds(viewport, bounds, size));
		},
		getScene: () => scene,
		getSelection: () => selection,
		getSnapshot: () => snapshot,
		getViewport: () => viewport,
		hitTest(point) {
			for (let index = scene.nodes.length - 1; index >= 0; index -= 1) {
				const node = scene.nodes[index];
				if (node && boxContains(node, point)) {
					return node;
				}
			}
			return null;
		},
		hitTestHandle(point) {
			if (scene.readOnly) {
				return null;
			}
			const node = singleSelectedNode(nodeIndex, selection);
			if (!node) {
				return null;
			}
			for (const handle of RESIZE_HANDLES) {
				if (handleHit(viewport, node, handle, point)) {
					return { handle, id: node.id };
				}
			}
			return null;
		},
		marqueeTo(point) {
			if (!marquee) {
				return;
			}
			setMarquee({ ...marquee, x2: point.x, y2: point.y });
		},
		nudge(direction, byGridStep) {
			if (scene.readOnly || !nudgeState) {
				return;
			}
			const step = byGridStep ? SNAP_STEP / viewport.zoom : NUDGE_UNIT;
			const vector = NUDGE_VECTORS[direction];
			setCurrentScene(
				moveNodes(scene, nudgeState.ids, vector.x * step, vector.y * step)
			);
		},
		panBy(dx, dy) {
			setViewport(panViewportBy(viewport, dx, dy));
		},
		paste() {
			if (scene.readOnly || !clipboard) {
				return;
			}
			commitPaste(clipboard);
		},
		get readOnly() {
			return Boolean(scene.readOnly);
		},
		redo() {
			const next = redoStack.pop();
			if (!next) {
				return;
			}
			pushCapped(undoStack, scene);
			restoreScene(next);
		},
		resetView() {
			setViewport(resetViewport(viewport));
		},
		resizeBy(direction, shrink = false) {
			if (scene.readOnly || dragState) {
				return false;
			}
			const handle = RESIZE_HANDLE_FOR_DIRECTION[direction];
			if (resizeState) {
				resizeState.handle = handle;
			} else {
				const node = singleSelectedNode(nodeIndex, selection);
				if (!node) {
					return false;
				}
				commitNudgeRun();
				resizeState = { before: scene, handle, id: node.id };
			}
			const node = nodeIndex.get(resizeState.id);
			if (!node) {
				return false;
			}
			const corner = handleWorldPoint(node, handle);
			const sign = shrink ? -1 : 1;
			const vector = NUDGE_VECTORS[direction];
			const step = (SNAP_STEP / viewport.zoom) * sign;
			applyResizeBox(node, handle, {
				x: corner.x + vector.x * step,
				y: corner.y + vector.y * step,
			});
			return true;
		},
		resizeTo(point) {
			if (scene.readOnly || !resizeState) {
				return;
			}
			const node = nodeIndex.get(resizeState.id);
			if (!node) {
				return;
			}
			applyResizeBox(node, resizeState.handle, point);
		},

		select(id) {
			if (id === null) {
				setSelection([]);
				return;
			}
			if (!nodeIndex.has(id)) {
				return;
			}
			setSelection([id]);
		},
		selectMany(ids) {
			const seen = new Set<string>();
			const nextSelection: string[] = [];
			for (const id of ids) {
				if (nodeIndex.has(id) && !seen.has(id)) {
					seen.add(id);
					nextSelection.push(id);
				}
			}
			setSelection(nextSelection);
		},
		setScene(nextScene) {
			const sceneChanged = nextScene !== scene;
			const historyChanged = undoStack.length > 0 || redoStack.length > 0;
			scene = nextScene;
			nodeIndex = buildNodeIndex(scene);
			selection = [];
			undoStack = [];
			redoStack = [];
			dragState = null;
			resizeState = null;
			nudgeState = null;
			marquee = null;
			if (
				sceneChanged ||
				historyChanged ||
				snapshot.selection.length > 0 ||
				snapshot.marquee !== null
			) {
				notify();
			}
		},
		setViewport(nextViewport) {
			if (sameViewport(viewport, nextViewport)) {
				return;
			}
			viewport = { ...nextViewport };
			notify();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		toggleSelect(id) {
			if (!nodeIndex.has(id)) {
				return;
			}
			if (selection.includes(id)) {
				setSelection(selection.filter((selectedId) => selectedId !== id));
				return;
			}
			setSelection([...selection, id]);
		},
		undo() {
			const previous = undoStack.pop();
			if (!previous) {
				return;
			}
			pushCapped(redoStack, scene);
			restoreScene(previous);
		},
		zoomAt(anchor, factor) {
			setViewport(zoomViewportAt(viewport, anchor, factor));
		},
	};

	function setViewport(nextViewport: Viewport): void {
		if (sameViewport(viewport, nextViewport)) {
			return;
		}
		viewport = { ...nextViewport };
		notify();
	}

	return editor;
}

function initialViewport(scene: Scene): Viewport {
	const placement = scenePlacement(scene);
	return { tx: placement.x, ty: placement.y, zoom: 1 };
}

function buildNodeIndex(scene: Scene): Map<string, SceneNode> {
	return new Map(scene.nodes.map((node) => [node.id, node]));
}

function pushCapped(stack: Scene[], value: Scene): void {
	if (stack.length >= HISTORY_LIMIT) {
		stack.shift();
	}
	stack.push(value);
}

function sameStrings(
	left: readonly string[],
	right: readonly string[]
): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}
