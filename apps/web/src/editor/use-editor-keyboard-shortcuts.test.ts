import { describe, expect, test } from 'bun:test';
import { createEditor } from '@kiyora/canvas/react';
import type { Scene } from '@kiyora/render';
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { withHappyDom } from './test-happy-dom';
import { useEditorKeyboardShortcuts } from './use-editor-keyboard-shortcuts';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const span = { end: { column: 2, line: 1 }, start: { column: 1, line: 1 } };

function makeScene(): Scene {
	return {
		edges: [],
		groups: [],
		nodes: [
			{
				height: 40,
				id: 'one',
				label: 'One',
				rotation: 0,
				span,
				width: 80,
				x: 0,
				y: 0,
			},
		],
		title: '',
	};
}

type HookProps = Parameters<typeof useEditorKeyboardShortcuts>[1];

function renderHook(
	hook: (props: HookProps) => void,
	options: { initialProps: HookProps }
): { rerender: (props: HookProps) => void; unmount: () => void } {
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	let setPropsRef: ((next: HookProps) => void) | null = null;

	function Wrapper(): null {
		const [props, setProps] = useState(options.initialProps);
		setPropsRef = setProps;
		hook(props);
		return null;
	}

	act(() => {
		root.render(createElement(Wrapper));
	});

	return {
		rerender: (next) => {
			act(() => {
				setPropsRef?.(next);
			});
		},
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
}): void {
	const event = new KeyboardEvent('keydown', {
		bubbles: true,
		cancelable: true,
		ctrlKey: options.ctrlKey ?? false,
		key: options.key,
		metaKey: options.metaKey ?? false,
		shiftKey: options.shiftKey ?? false,
	});
	window.dispatchEvent(event);
}

describe('useEditorKeyboardShortcuts', () => {
	test('⌘+Z calls editor.undo when no textarea is focused', () => {
		withHappyDom();
		const editor = createEditor(makeScene());
		editor.beginDrag('one');
		editor.drag(8, 0);
		editor.endDrag();
		expect(editor.canUndo).toBe(true);

		const { unmount } = renderHook(
			(props) => useEditorKeyboardShortcuts(editor, props),
			{ initialProps: { isTextareaFocused: () => false } }
		);

		dispatchKey({ key: 'z', metaKey: true });

		expect(editor.getScene().nodes[0]?.x).toBe(0);
		unmount();
	});

	test('Ctrl+Z calls editor.undo when no textarea is focused', () => {
		withHappyDom();
		const editor = createEditor(makeScene());
		editor.beginDrag('one');
		editor.drag(8, 0);
		editor.endDrag();

		const { unmount } = renderHook(
			(props) => useEditorKeyboardShortcuts(editor, props),
			{ initialProps: { isTextareaFocused: () => false } }
		);

		dispatchKey({ ctrlKey: true, key: 'z' });

		expect(editor.getScene().nodes[0]?.x).toBe(0);
		unmount();
	});

	test('⌘+Shift+Z calls editor.redo when no textarea is focused', () => {
		withHappyDom();
		const editor = createEditor(makeScene());
		editor.beginDrag('one');
		editor.drag(8, 0);
		editor.endDrag();
		editor.undo();
		expect(editor.canRedo).toBe(true);

		const { unmount } = renderHook(
			(props) => useEditorKeyboardShortcuts(editor, props),
			{ initialProps: { isTextareaFocused: () => false } }
		);

		dispatchKey({ key: 'z', metaKey: true, shiftKey: true });

		expect(editor.getScene().nodes[0]?.x).toBe(8);
		unmount();
	});

	test('does not call editor.undo when a textarea is focused', () => {
		withHappyDom();
		const editor = createEditor(makeScene());
		editor.beginDrag('one');
		editor.drag(8, 0);
		editor.endDrag();
		const before = editor.getScene().nodes[0]?.x;
		expect(before).toBe(8);

		const { unmount } = renderHook(
			(props) => useEditorKeyboardShortcuts(editor, props),
			{ initialProps: { isTextareaFocused: () => true } }
		);

		dispatchKey({ key: 'z', metaKey: true });

		expect(editor.getScene().nodes[0]?.x).toBe(before);
		expect(editor.canUndo).toBe(true);
		unmount();
	});

	test('detaches the listener on unmount', () => {
		withHappyDom();
		const editor = createEditor(makeScene());
		editor.beginDrag('one');
		editor.drag(8, 0);
		editor.endDrag();

		const { unmount } = renderHook(
			(props) => useEditorKeyboardShortcuts(editor, props),
			{ initialProps: { isTextareaFocused: () => false } }
		);
		unmount();

		dispatchKey({ key: 'z', metaKey: true });
		expect(editor.getScene().nodes[0]?.x).toBe(8);
	});

	test('ignores non-shortcut keys', () => {
		withHappyDom();
		const editor = createEditor(makeScene());
		const { unmount } = renderHook(
			(props) => useEditorKeyboardShortcuts(editor, props),
			{ initialProps: { isTextareaFocused: () => false } }
		);

		dispatchKey({ key: 'a' });
		dispatchKey({ ctrlKey: true, key: 'a' });
		dispatchKey({ key: 'z' });

		expect(editor.canUndo).toBe(false);
		expect(editor.canRedo).toBe(false);
		unmount();
	});
});
