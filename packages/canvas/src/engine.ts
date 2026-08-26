import type { Editor } from './editor';
import { attachInput, type InputHandlers } from './input';
import { contentOffsetForScene, renderScene } from './renderer';

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
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

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
	let dragging = false;
	let renderedScene = editor.getSnapshot().scene;
	let contentOffset = contentOffsetForScene(editor.getSnapshot());
	const inputHandlers: InputHandlers = {
		onDragStateChange(nextDragging) {
			dragging = nextDragging;
		},
		worldOffset: contentOffset,
	};

	function render(): void {
		if (destroyed) {
			return;
		}
		const snapshot = editor.getSnapshot();
		if (!dragging && snapshot.scene !== renderedScene) {
			contentOffset = contentOffsetForScene(snapshot);
			inputHandlers.worldOffset = contentOffset;
		}
		renderedScene = snapshot.scene;
		const bounds = container.getBoundingClientRect();
		const width = bounds.width || container.clientWidth;
		const height = bounds.height || container.clientHeight;
		const markup = renderScene(snapshot, {
			contentOffset,
			height: height > 0 ? height : DEFAULT_HEIGHT,
			showGrid: options.showGrid ?? true,
			width: width > 0 ? width : DEFAULT_WIDTH,
		});
		const openingEnd = markup.indexOf('>');
		const closingStart = markup.lastIndexOf('</svg>');
		if (openingEnd < 0 || closingStart < openingEnd) {
			return;
		}
		const openingTag = markup.slice(0, openingEnd + 1);
		const widthAttribute = openingTag.match(/ width="([^"]+)"/u)?.[1];
		const heightAttribute = openingTag.match(/ height="([^"]+)"/u)?.[1];
		const viewBoxAttribute = openingTag.match(/ viewBox="([^"]+)"/u)?.[1];
		if (widthAttribute) {
			svg.setAttribute('width', widthAttribute);
		}
		if (heightAttribute) {
			svg.setAttribute('height', heightAttribute);
		}
		if (viewBoxAttribute) {
			svg.setAttribute('viewBox', viewBoxAttribute);
		}
		svg.innerHTML = markup.slice(openingEnd + 1, closingStart);
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
