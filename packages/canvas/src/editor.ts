import type { Scene, SceneNode } from '@kiyora/render';
import type { Bounds, Point, Viewport } from './viewport';

/** The immutable state exposed by an Editor. */
export type EditorSnapshot = {
	scene: Scene;
	selection: readonly string[];
	viewport: Viewport;
};

/** Framework-agnostic canvas state API. Behavior is added in issue 03. */
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

/** Create an Editor for a Scene. Implementation arrives in issue 03. */
export function createEditor(_initialScene?: Scene): Editor {
	throw new Error('createEditor is not implemented yet');
}
