import type { EditorSnapshot } from './editor';

/** Options for the canvas SVG projection. */
export type RenderSceneOptions = {
	showGrid?: boolean;
};

/** Scaffold renderer; full Scene projection arrives in issue 04. */
export function renderScene(
	_snapshot: EditorSnapshot,
	_options: RenderSceneOptions = {}
): string {
	throw new Error('renderScene is not implemented yet');
}
