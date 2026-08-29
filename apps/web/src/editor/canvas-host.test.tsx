import { describe, expect, test } from 'bun:test';
import { createEditor } from '@kiyora/canvas/react';
import type { Scene } from '@kiyora/render';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasHost } from './canvas-host';
import { withHappyDom } from './test-happy-dom';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
				height: 200,
				id: 'one',
				label: 'One',
				span,
				width: 200,
				x: 0,
				y: 0,
			},
		],
		title: '',
	};
}

describe('CanvasHost', () => {
	test('fits the viewport to the scene on first mount', () => {
		const { d } = withHappyDom();
		const container = d.createElement('div');
		d.body.append(container);
		const editor = createEditor(makeScene());
		// A non-default starting viewport so the assertion is meaningful.
		editor.setViewport({ tx: 5000, ty: 5000, zoom: 4 });

		const root = createRoot(container as unknown as Element);
		act(() => {
			root.render(
				createElement(CanvasHost, {
					downloadable: { save: () => undefined },
					editor,
					getContainerSize: () => ({ height: 480, width: 640 }),
					source: '',
					title: '',
				})
			);
		});

		const viewport = editor.getViewport();
		// 200x200 content fitted into 640x480 → zoom = min(640/200, 480/200) = 2.4.
		expect(viewport.zoom).toBeCloseTo(2.4, 2);
		// Centered horizontally: (640 - 200*2.4)/2 = 80. ty is 0 because the
		// bounds start at y=0.
		expect(viewport.tx).toBeCloseTo(80, 2);
		expect(viewport.ty).toBeCloseTo(0, 2);

		act(() => {
			root.unmount();
		});
	});

	test('does not refit the viewport when the scene is recompiled', () => {
		const { d } = withHappyDom();
		const container = d.createElement('div');
		d.body.append(container);
		const editor = createEditor(makeScene());
		// Move the camera so the content is off-screen, forcing a real fit on
		// mount.
		editor.setViewport({ tx: 5000, ty: 5000, zoom: 4 });

		const root = createRoot(container as unknown as Element);
		act(() => {
			root.render(
				createElement(CanvasHost, {
					downloadable: { save: () => undefined },
					editor,
					getContainerSize: () => ({ height: 480, width: 640 }),
					source: '',
					title: '',
				})
			);
		});

		const fitted = editor.getViewport();
		expect(fitted).not.toEqual({ tx: 5000, ty: 5000, zoom: 4 });

		// Recompile with a new scene — the viewport must stay where fit put it.
		const nextScene: Scene = {
			edges: [],
			groups: [],
			nodes: [
				{
					height: 50,
					id: 'two',
					label: 'Two',
					span,
					width: 50,
					x: 0,
					y: 0,
				},
			],
			title: '',
		};
		act(() => {
			editor.setScene(nextScene);
		});

		expect(editor.getViewport()).toEqual(fitted);

		act(() => {
			root.unmount();
		});
	});

	test('renders the canvas and the toolbar', () => {
		const { d } = withHappyDom();
		const container = d.createElement('div');
		d.body.append(container);
		const editor = createEditor(makeScene());

		const root = createRoot(container as unknown as Element);
		act(() => {
			root.render(
				createElement(CanvasHost, {
					downloadable: { save: () => undefined },
					editor,
					getContainerSize: () => ({ height: 480, width: 640 }),
					source: '',
					title: '',
				})
			);
		});

		expect(container.querySelector('[data-kiyora-canvas]')).not.toBeNull();
		expect(
			container.querySelector('[data-toolbar-action="undo"]')
		).not.toBeNull();
		expect(
			container.querySelector('[data-toolbar-action="redo"]')
		).not.toBeNull();
		expect(
			container.querySelector('[data-toolbar-action="fit"]')
		).not.toBeNull();
		expect(
			container.querySelector('[data-toolbar-action="reset"]')
		).not.toBeNull();
		expect(container.querySelector('[data-toolbar-zoom]')).not.toBeNull();

		act(() => {
			root.unmount();
		});
	});
});
