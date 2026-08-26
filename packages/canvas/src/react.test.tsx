import { describe, expect, test } from 'bun:test';
import type { Scene, SceneNode } from '@kiyora/render';
import { Window } from 'happy-dom';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { createEditor } from './editor';
import { Canvas, useEditor, useShape } from './react';

const reactGlobals = globalThis as typeof globalThis & {
	IS_REACT_ACT_ENVIRONMENT?: boolean;
};
reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;

const span = {
	end: { column: 2, line: 1 },
	start: { column: 1, line: 1 },
};

function makeScene(): Scene {
	return {
		edges: [],
		groups: [],
		nodes: [
			{
				height: 40,
				id: 'one',
				label: 'One',
				span,
				width: 80,
				x: 0,
				y: 0,
			},
			{
				height: 40,
				id: 'two',
				label: 'Two',
				span,
				width: 80,
				x: 100,
				y: 0,
			},
		],
		title: '',
	};
}

function Probe({
	onRender,
}: {
	onRender: (node: SceneNode | undefined) => void;
}) {
	const node = useShape('one');
	const editor = useEditor();
	useEffect(() => {
		onRender(node);
	}, [node, onRender]);
	return createElement('span', {
		'data-node-label': node?.label,
		'data-zoom': editor.getViewport().zoom,
	});
}

describe('React canvas adapter', () => {
	test('renders an empty canvas host during SSR', () => {
		const editor = createEditor(makeScene());
		const markup = renderToString(createElement(Canvas, { editor }));

		expect(markup).toContain('data-kiyora-canvas');
		expect(markup).not.toContain('<svg');
		expect(markup).not.toContain('One');
	});

	test('mounts the Engine on the client and provides live, stable shapes', () => {
		const window = new Window();
		const { document } = window;
		const globals = globalThis as unknown as {
			document?: Document;
			window?: Window;
		};
		const previousDocument = globals.document;
		const previousWindow = globals.window;
		Object.assign(globals, {
			document: document as unknown as Document,
			window: window as unknown as Window,
		});
		const container = document.createElement('div');
		document.body.append(container);
		const editor = createEditor(makeScene());
		const renders: Array<SceneNode | undefined> = [];
		const onRender = (node: SceneNode | undefined) => renders.push(node);
		const root = createRoot(container as unknown as Element);
		act(() => {
			root.render(
				createElement(Canvas, { editor }, createElement(Probe, { onRender }))
			);
		});

		expect(container.querySelector('[data-kiyora-canvas] svg')).not.toBeNull();
		expect(
			container
				.querySelector('[data-node-label]')
				?.getAttribute('data-node-label')
		).toBe('One');
		const firstNode = renders.at(-1);
		const [one] = editor.getScene().nodes;
		expect(firstNode).toBe(one);
		const renderCount = renders.length;

		const [, unrelated] = editor.getScene().nodes;
		if (!unrelated) {
			throw new Error('test scene did not include an unrelated node');
		}
		act(() => {
			editor.beginDrag('two', { x: 120, y: 20 });
			editor.drag(10, 0);
			editor.endDrag();
		});

		expect(renders.length).toBe(renderCount);
		expect(renders.at(-1)).toBe(firstNode);
		const [, movedNode] = editor.getScene().nodes;
		expect(movedNode).not.toBe(unrelated);
		act(() => {
			root.unmount();
		});
		globals.document = previousDocument;
		globals.window = previousWindow;
	});

	test('useEditor explains when it is used outside Canvas', () => {
		function Outside() {
			useEditor();
			return null;
		}
		expect(() => renderToString(createElement(Outside))).toThrow(
			'useEditor must be used inside a <Canvas> component.'
		);
	});
});
