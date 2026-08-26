import type { Editor } from './editor';

/** The DOM binding for an Editor. */
export type Engine = {
	destroy: () => void;
	render: () => void;
	readonly editor: Editor;
};

/** Scaffold engine; DOM binding arrives in issue 05. */
export function createEngine(_container: HTMLElement, _editor: Editor): Engine {
	throw new Error('createEngine is not implemented yet');
}
