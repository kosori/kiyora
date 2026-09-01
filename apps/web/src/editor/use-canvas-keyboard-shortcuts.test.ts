import { describe, expect, test } from 'bun:test';
import { createEditor } from '@kiyora/canvas/react';
import type { Scene } from '@kiyora/render';
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { withHappyDom } from './test-happy-dom';
import { useCanvasKeyboardShortcuts } from './use-canvas-keyboard-shortcuts';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const span = { end: { column: 2, line: 1 }, start: { column: 1, line: 1 } };

function sceneWithNodes(...ids: string[]): Scene {
	return {
		edges: [],
		groups: [],
		nodes: ids.map((id) => ({
			height: 20,
			id,
			label: id,
			span,
			width: 20,
			x: 0,
			y: 0,
		})),
		title: '',
	};
}

type HookProps = Parameters<typeof useCanvasKeyboardShortcuts>[1];

function renderHook(
	editor: Parameters<typeof useCanvasKeyboardShortcuts>[0],
	options: { initialProps: HookProps }
): { unmount: () => void } {
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);

	function Wrapper(): null {
		const [props] = useState(options.initialProps);
		useCanvasKeyboardShortcuts(editor, props);
		return null;
	}

	act(() => {
		root.render(createElement(Wrapper));
	});

	return {
		unmount: () => {
			act(() => {
				root.unmount();
			});
		},
	};
}

function dispatchKey(options: {
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	key: string;
	type?: 'keydown' | 'keyup';
}): KeyboardEvent {
	const event = new KeyboardEvent(options.type ?? 'keydown', {
		bubbles: true,
		cancelable: true,
		ctrlKey: options.ctrlKey ?? false,
		key: options.key,
		metaKey: options.metaKey ?? false,
		shiftKey: options.shiftKey ?? false,
	});
	window.dispatchEvent(event);
	return event;
}

describe('useCanvasKeyboardShortcuts', () => {
	test('Delete removes the selection when no textarea is focused', () => {
		withHappyDom();
		const editor = createEditor(sceneWithNodes('one', 'two'));
		editor.selectMany(['one']);

		const { unmount } = renderHook(editor, {
			initialProps: { isTextareaFocused: () => false },
		});

		const event = dispatchKey({ key: 'Delete' });

		expect(editor.getScene().nodes.map(({ id }) => id)).toEqual(['two']);
		expect(event.defaultPrevented).toBe(true);
		unmount();
	});

	test('⌘/Ctrl+C, X, V, and D drive copy, cut, paste, and duplicate', () => {
		withHappyDom();
		const editor = createEditor(sceneWithNodes('one'));
		editor.select('one');

		const { unmount } = renderHook(editor, {
			initialProps: { isTextareaFocused: () => false },
		});

		dispatchKey({ key: 'c', metaKey: true });
		dispatchKey({ key: 'Delete' });
		expect(editor.getScene().nodes).toHaveLength(0);

		dispatchKey({ ctrlKey: true, key: 'v' });
		expect(editor.getScene().nodes.map(({ id }) => id)).toEqual(['one-copy']);

		editor.select('one-copy');
		dispatchKey({ ctrlKey: true, key: 'x' });
		expect(editor.getScene().nodes).toHaveLength(0);

		dispatchKey({ key: 'v', metaKey: true });
		expect(editor.getScene().nodes.map(({ id }) => id)).toEqual([
			'one-copy-copy',
		]);

		editor.select('one-copy-copy');
		dispatchKey({ ctrlKey: true, key: 'd' });
		expect(editor.getScene().nodes.map(({ id }) => id)).toEqual([
			'one-copy-copy',
			'one-copy-copy-copy',
		]);
		unmount();
	});

	test('arrow keys nudge the selection and coalesce into one history entry per run', () => {
		withHappyDom();
		const editor = createEditor(sceneWithNodes('one'));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');

		const { unmount } = renderHook(editor, {
			initialProps: { isTextareaFocused: () => false },
		});

		dispatchKey({ key: 'ArrowRight' });
		dispatchKey({ key: 'ArrowRight' });
		dispatchKey({ key: 'ArrowDown' });
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 2, y: 1 });
		expect(editor.canUndo).toBe(false);
		dispatchKey({ key: 'ArrowRight', type: 'keyup' });

		expect(editor.canUndo).toBe(true);
		editor.undo();
		expect(editor.getScene().nodes[0]).toMatchObject({ x: 0, y: 0 });

		dispatchKey({ key: 'ArrowLeft', shiftKey: true });
		dispatchKey({ key: 'ArrowLeft', type: 'keyup' });
		expect(editor.getScene().nodes[0]).toMatchObject({ x: -8, y: 0 });
		unmount();
	});

	test('a keyup ends the nudge run even when a textarea gains focus mid-hold', () => {
		withHappyDom();
		const editor = createEditor(sceneWithNodes('one'));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		let textareaFocused = false;

		const { unmount } = renderHook(editor, {
			initialProps: { isTextareaFocused: () => textareaFocused },
		});

		dispatchKey({ key: 'ArrowRight' });
		textareaFocused = true;
		dispatchKey({ key: 'ArrowRight', type: 'keyup' });
		textareaFocused = false;

		expect(editor.canUndo).toBe(true);
		dispatchKey({ key: 'ArrowRight' });
		dispatchKey({ key: 'ArrowRight', type: 'keyup' });
		expect(editor.getScene().nodes[0]?.x).toBe(2);
		unmount();
	});

	test('arrow keys leave page scrolling alone when nothing is selected', () => {
		withHappyDom();
		const editor = createEditor(sceneWithNodes('one'));

		const { unmount } = renderHook(editor, {
			initialProps: { isTextareaFocused: () => false },
		});

		const event = dispatchKey({ key: 'ArrowRight' });
		dispatchKey({ key: 'ArrowRight', type: 'keyup' });

		expect(event.defaultPrevented).toBe(false);
		expect(editor.canUndo).toBe(false);
		unmount();
	});

	test('no shortcut fires while a textarea is focused', () => {
		withHappyDom();
		const editor = createEditor(sceneWithNodes('one'));
		editor.setViewport({ tx: 0, ty: 0, zoom: 1 });
		editor.select('one');
		const before = editor.getSnapshot();

		const { unmount } = renderHook(editor, {
			initialProps: { isTextareaFocused: () => true },
		});

		for (const event of [
			dispatchKey({ key: 'Delete' }),
			dispatchKey({ key: 'Backspace' }),
			dispatchKey({ key: 'c', metaKey: true }),
			dispatchKey({ ctrlKey: true, key: 'x' }),
			dispatchKey({ key: 'v', metaKey: true }),
			dispatchKey({ ctrlKey: true, key: 'd' }),
			dispatchKey({ key: 'ArrowRight' }),
			dispatchKey({ key: 'ArrowUp', shiftKey: true }),
		]) {
			expect(event.defaultPrevented).toBe(false);
		}
		dispatchKey({ key: 'ArrowRight', type: 'keyup' });

		expect(editor.getSnapshot()).toBe(before);
		expect(editor.canUndo).toBe(false);
		unmount();
	});

	test('detaches the listeners on unmount', () => {
		withHappyDom();
		const editor = createEditor(sceneWithNodes('one'));
		editor.select('one');
		const before = editor.getSnapshot();

		const { unmount } = renderHook(editor, {
			initialProps: { isTextareaFocused: () => false },
		});
		unmount();

		dispatchKey({ key: 'Delete' });
		dispatchKey({ key: 'ArrowRight' });
		dispatchKey({ key: 'ArrowRight', type: 'keyup' });
		expect(editor.getSnapshot()).toBe(before);
	});
});
