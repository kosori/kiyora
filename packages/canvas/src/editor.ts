import type { Scene, SceneNode } from '@kiyora/render';
import type { Bounds, Point, Viewport } from './viewport';
import {
	createViewport,
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
	beginDrag: (id: string, point: Point) => void;
	drag: (dx: number, dy: number) => void;
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

const HISTORY_LIMIT = 200;

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
	let viewport = createViewport();
	let selection: readonly string[] = [];
	let nodeIndex = buildNodeIndex(scene);
	let undoStack: Scene[] = [];
	let redoStack: Scene[] = [];
	let dragState: DragState | null = null;
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

	const editor: Editor = {
		beginDrag(id, _point) {
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
		drag(dx, dy) {
			if (!dragState || (dx === 0 && dy === 0)) {
				return;
			}
			setCurrentScene(moveNodes(scene, dragState.ids, dx, dy));
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
