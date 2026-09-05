import type { Editor } from './editor';
import { attachInput, type InputHandlers } from './input';
import { renderSceneResult } from './renderer';

/** Options for the DOM binding of an Editor. */
export type EngineOptions = {
	showGrid?: boolean;
};

/** The DOM binding for an Editor. */
export type Engine = {
	destroy: () => void;
	render: () => void;
	readonly editor: Editor;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
/** Mount an interactive SVG view of an Editor into a container. */
export function createEngine(
	container: HTMLElement,
	editor: Editor,
	options: EngineOptions = {}
): Engine {
	const document = container.ownerDocument;
	const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
	svg.style.display = 'block';
	svg.style.width = '100%';
	svg.style.height = '100%';
	svg.style.touchAction = 'none';
	svg.style.userSelect = 'none';
	svg.style.cursor = 'default';
	container.appendChild(svg);

	let destroyed = false;
	const inputHandlers: InputHandlers = {};

	function render(): void {
		if (destroyed) {
			return;
		}
		const snapshot = editor.getSnapshot();
		const bounds = container.getBoundingClientRect();
		const width = bounds.width || container.clientWidth;
		const height = bounds.height || container.clientHeight;
		const result = renderSceneResult(snapshot, {
			height: height > 0 ? height : 1,
			showGrid: options.showGrid ?? true,
			width: width > 0 ? width : 1,
			// The product canvas opts into the display-only wobble layer
			// explicitly; pure projections stay clean unless asked otherwise.
			wobble: true,
		});
		svg.setAttribute('width', String(result.width));
		svg.setAttribute('height', String(result.height));
		svg.setAttribute('viewBox', result.viewBox);
		svg.innerHTML = result.body;
	}

	const unsubscribe = editor.subscribe(render);
	const detachInput = attachInput(svg, editor, inputHandlers);
	const ResizeObserverConstructor =
		document.defaultView?.ResizeObserver ??
		(typeof ResizeObserver === 'undefined' ? undefined : ResizeObserver);
	const observer = ResizeObserverConstructor
		? new ResizeObserverConstructor(() => render())
		: null;
	observer?.observe(container);
	render();

	return {
		destroy() {
			if (destroyed) {
				return;
			}
			destroyed = true;
			observer?.disconnect();
			detachInput();
			unsubscribe();
			svg.remove();
		},
		editor,
		render,
	};
}
