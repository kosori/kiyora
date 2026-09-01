import {
	type Scene,
	type SceneEdge,
	type SceneNode,
	scenePlacement,
} from '@kiyora/render';
import type { Bounds, Point, Viewport } from './viewport';
import {
	fitToBounds as fitViewportToBounds,
	panBy as panViewportBy,
	resetView as resetViewport,
	zoomAt as zoomViewportAt,
} from './viewport';

/** The immutable state exposed by an Editor. */
export type EditorSnapshot = {
	scene: Scene;
	selection: readonly string[];
	viewport: Viewport;
};

/** Framework-agnostic canvas state API. */
export type Editor = {
	readonly canRedo: boolean;
	readonly canUndo: boolean;
	beginDrag: (id: string) => void;
	copy: () => void;
	cut: () => void;
	deleteSelection: () => void;
	drag: (dx: number, dy: number) => void;
	duplicate: () => void;
	endDrag: () => void;
	fitToBounds: (
		bounds: Bounds,
		size: { height: number; width: number }
	) => void;
	getScene: () => Scene;
	getSelection: () => readonly string[];
	getSnapshot: () => EditorSnapshot;
	getViewport: () => Viewport;
	hitTest: (point: Point) => SceneNode | null;
	panBy: (dx: number, dy: number) => void;
	paste: () => void;
	resetView: () => void;
	redo: () => void;
	select: (id: string | null) => void;
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

type ClipboardFragment = {
	edges: readonly SceneEdge[];
	nodes: readonly SceneNode[];
};

type DragState = {
	ids: readonly string[];
	before: Scene;
};

function sameViewport(left: Viewport, right: Viewport): boolean {
	return (
		left.zoom === right.zoom && left.tx === right.tx && left.ty === right.ty
	);
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
	let nodeIndex = buildNodeIndex(scene);
	let undoStack: Scene[] = [];
	let redoStack: Scene[] = [];
	let dragState: DragState | null = null;
	let clipboard: ClipboardFragment | null = null;
	const listeners = new Set<() => void>();

	let snapshot: EditorSnapshot = { scene, selection, viewport };

	function notify(): void {
		snapshot = { scene, selection, viewport };
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
		setCurrentScene(restored);
	}

	function commitScene(nextScene: Scene): void {
		if (nextScene === scene) {
			return;
		}
		pushCapped(undoStack, scene);
		redoStack = [];
		setCurrentScene(nextScene);
	}

	function deleteSelectedNodes(): void {
		if (selection.length === 0) {
			return;
		}
		commitScene(deleteNodes(scene, selection));
		setSelection([]);
	}

	function commitPaste(fragment: ClipboardFragment): void {
		commitScene(pasteFragment(scene, fragment, PASTE_OFFSET, PASTE_OFFSET));
	}

	const editor: Editor = {
		beginDrag(id) {
			const node = nodeIndex.get(id);
			if (!node) {
				return;
			}
			const ids = selection.includes(id)
				? selection.filter((selectedId) => nodeIndex.has(selectedId))
				: [id];
			dragState = { before: scene, ids };
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
			const fragment = captureFragment(scene, selection);
			if (!fragment) {
				return;
			}
			clipboard = fragment;
			deleteSelectedNodes();
		},
		deleteSelection() {
			deleteSelectedNodes();
		},
		drag(dx, dy) {
			if (!dragState || (dx === 0 && dy === 0)) {
				return;
			}
			setCurrentScene(moveNodes(scene, dragState.ids, dx, dy));
		},
		duplicate() {
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
			if (scene !== before) {
				pushCapped(undoStack, before);
				redoStack = [];
			}
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
		panBy(dx, dy) {
			setViewport(panViewportBy(viewport, dx, dy));
		},
		paste() {
			if (!clipboard) {
				return;
			}
			commitPaste(clipboard);
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
		setScene(nextScene) {
			const sceneChanged = nextScene !== scene;
			const historyChanged = undoStack.length > 0 || redoStack.length > 0;
			scene = nextScene;
			nodeIndex = buildNodeIndex(scene);
			selection = [];
			undoStack = [];
			redoStack = [];
			dragState = null;
			if (sceneChanged || historyChanged || snapshot.selection.length > 0) {
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
