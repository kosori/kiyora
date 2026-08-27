import { describe, expect, test } from 'bun:test';
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { withHappyDom } from './test-happy-dom';
import { useCompileShortcut } from './use-compile-shortcut';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type RenderArgs = { disabled: boolean; isDialogFocused: () => boolean };

function renderHook(initialArgs: RenderArgs): {
	calls: number[];
	rerender: (next: RenderArgs) => void;
	unmount: () => void;
} {
	let setPropsRef: ((next: RenderArgs) => void) | null = null;
	const calls: number[] = [];

	function Wrapper(): null {
		const [args, setArgs] = useState<RenderArgs>(initialArgs);
		setPropsRef = setArgs;
		useCompileShortcut(
			args.disabled,
			() => {
				calls.push(calls.length);
			},
			{ isDialogFocused: args.isDialogFocused }
		);
		return null;
	}

	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	act(() => {
		root.render(createElement(Wrapper));
	});

	return {
		calls,
		rerender(next: RenderArgs) {
			act(() => {
				setPropsRef?.(next);
			});
		},
		unmount() {
			act(() => {
				root.unmount();
			});
			container.remove();
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

describe('useCompileShortcut', () => {
	test('⌘+Enter invokes the compile callback', () => {
		withHappyDom();
		const { calls, unmount } = renderHook({
			disabled: false,
			isDialogFocused: () => false,
		});

		dispatchKey({ key: 'Enter', metaKey: true });

		expect(calls).toHaveLength(1);
		unmount();
	});

	test('Ctrl+Enter invokes the compile callback', () => {
		withHappyDom();
		const { calls, unmount } = renderHook({
			disabled: false,
			isDialogFocused: () => false,
		});

		dispatchKey({ ctrlKey: true, key: 'Enter' });

		expect(calls).toHaveLength(1);
		unmount();
	});

	test('does not invoke the callback for plain Enter', () => {
		withHappyDom();
		const { calls, unmount } = renderHook({
			disabled: false,
			isDialogFocused: () => false,
		});

		dispatchKey({ key: 'Enter' });

		expect(calls).toHaveLength(0);
		unmount();
	});

	test('does not invoke the callback when disabled', () => {
		withHappyDom();
		const { calls, unmount } = renderHook({
			disabled: true,
			isDialogFocused: () => false,
		});

		dispatchKey({ key: 'Enter', metaKey: true });

		expect(calls).toHaveLength(0);
		unmount();
	});

	test('ignores the key when a dialog or modal is focused', () => {
		withHappyDom();
		const { calls, unmount } = renderHook({
			disabled: false,
			isDialogFocused: () => true,
		});

		dispatchKey({ key: 'Enter', metaKey: true });

		expect(calls).toHaveLength(0);
		unmount();
	});

	test('detaches the listener on unmount', () => {
		withHappyDom();
		const { calls, unmount } = renderHook({
			disabled: false,
			isDialogFocused: () => false,
		});

		unmount();
		dispatchKey({ key: 'Enter', metaKey: true });

		expect(calls).toHaveLength(0);
	});
});
