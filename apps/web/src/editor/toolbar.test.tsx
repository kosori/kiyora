import { describe, expect, mock, test } from 'bun:test';
import { createEditor, type Editor } from '@kiyora/canvas/react';
import type { Scene } from '@kiyora/render';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { withHappyDom } from './test-happy-dom';
import { Toolbar } from './toolbar';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
		],
		title: '',
	};
}

describe('Toolbar', () => {
	test('disables Undo and Redo when the editor history is empty', () => {
		const { d } = withHappyDom();
		const container = d.createElement('div');
		d.body.append(container);
		const editor = createEditor(makeScene());
		const root = createRoot(container as unknown as Element);
		act(() => {
			root.render(
				createElement(Toolbar, {
					editor,
					getContainerSize: () => ({ height: 480, width: 640 }),
				})
			);
		});

		const undoButton = container.querySelector<HTMLButtonElement>(
			'[data-toolbar-action="undo"]'
		);
		const redoButton = container.querySelector<HTMLButtonElement>(
			'[data-toolbar-action="redo"]'
		);
		expect(undoButton?.disabled).toBe(true);
		expect(redoButton?.disabled).toBe(true);

		act(() => {
			root.unmount();
		});
	});

	test('calls editor.undo and editor.redo when buttons are clicked', () => {
		const { d } = withHappyDom();
		const container = d.createElement('div');
		d.body.append(container);
		const editor = createEditor(makeScene());
		editor.beginDrag('one');
		editor.drag(8, 0);
		editor.endDrag();
		expect(editor.canUndo).toBe(true);

		const root = createRoot(container as unknown as Element);
		act(() => {
			root.render(
				createElement(Toolbar, {
					editor,
					getContainerSize: () => ({ height: 480, width: 640 }),
				})
			);
		});

		const undoButton = container.querySelector<HTMLButtonElement>(
			'[data-toolbar-action="undo"]'
		);
		const redoButton = container.querySelector<HTMLButtonElement>(
			'[data-toolbar-action="redo"]'
		);
		expect(undoButton?.disabled).toBe(false);

		// The first click of Undo undoes the drag and fills the redo stack.
		act(() => {
			undoButton?.click();
		});
		expect(editor.canRedo).toBe(true);
		expect(redoButton?.disabled).toBe(false);

		act(() => {
			redoButton?.click();
		});
		// After a redo, the original drag is back on the scene.
		const [node] = editor.getScene().nodes;
		expect(node?.x).toBe(8);

		act(() => {
			root.unmount();
		});
	});

	test('zoom-to-fit uses the current container size', () => {
		const { d } = withHappyDom();
		const container = d.createElement('div');
		d.body.append(container);
		const editor = createEditor(makeScene());
		const fitSpy = mock(
			(_bounds: unknown, _size: { height: number; width: number }) => undefined
		);
		editor.fitToBounds = fitSpy as unknown as Editor['fitToBounds'];

		const root = createRoot(container as unknown as Element);
		let index = 0;
		act(() => {
			root.render(
				createElement(Toolbar, {
					editor,
					getContainerSize: () => {
						const size = { height: 200, width: 300 };
						index += 1;
						return size;
					},
				})
			);
		});

		const fitButton = container.querySelector<HTMLButtonElement>(
			'[data-toolbar-action="fit"]'
		);
		act(() => {
			fitButton?.click();
		});

		expect(fitSpy).toHaveBeenCalledTimes(1);
		const [bounds, size] = fitSpy.mock.calls[0] ?? [undefined, undefined];
		expect(size).toEqual({ height: 200, width: 300 });
		// The bounds are derived from the scene's nodes.
		expect(typeof bounds).toBe('object');
		// The getContainerSize getter was called when the fit button was
		// clicked, advancing the index past zero.
		expect(index).toBeGreaterThan(0);

		act(() => {
			root.unmount();
		});
	});

	test('displays the current viewport zoom as a percentage', () => {
		const { d } = withHappyDom();
		const container = d.createElement('div');
		d.body.append(container);
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 0, ty: 0, zoom: 1.5 });

		const root = createRoot(container as unknown as Element);
		act(() => {
			root.render(
				createElement(Toolbar, {
					editor,
					getContainerSize: () => ({ height: 480, width: 640 }),
				})
			);
		});

		const readout = container.querySelector('[data-toolbar-zoom]');
		expect(readout?.textContent).toBe('150%');

		act(() => {
			editor.setViewport({ tx: 0, ty: 0, zoom: 0.75 });
		});
		expect(readout?.textContent).toBe('75%');

		act(() => {
			root.unmount();
		});
	});

	test('reset-view button restores the identity viewport', () => {
		const { d } = withHappyDom();
		const container = d.createElement('div');
		d.body.append(container);
		const editor = createEditor(makeScene());
		editor.setViewport({ tx: 50, ty: 50, zoom: 2 });

		const root = createRoot(container as unknown as Element);
		act(() => {
			root.render(
				createElement(Toolbar, {
					editor,
					getContainerSize: () => ({ height: 480, width: 640 }),
				})
			);
		});

		const resetButton = container.querySelector<HTMLButtonElement>(
			'[data-toolbar-action="reset"]'
		);
		act(() => {
			resetButton?.click();
		});

		expect(editor.getViewport()).toEqual({ tx: 0, ty: 0, zoom: 1 });

		act(() => {
			root.unmount();
		});
	});
});
