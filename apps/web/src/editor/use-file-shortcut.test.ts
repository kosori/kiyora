import { describe, expect, mock, test } from 'bun:test';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { withHappyDom } from './test-happy-dom';
import { useFileShortcut } from './use-file-shortcut';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type RenderArgs = {
	isTextareaFocused: () => boolean;
};

function renderHook(initialArgs: RenderArgs): {
	onSave: ReturnType<typeof mock>;
	onOpen: ReturnType<typeof mock>;
	rerender: (next: RenderArgs) => void;
	unmount: () => void;
} {
	const onSave = mock(() => undefined);
	const onOpen = mock(() => undefined);
	let setPropsRef: ((next: RenderArgs) => void) | null = null;

	function Wrapper(): null {
		const [args, setArgs] = useState(initialArgs);
		setPropsRef = setArgs;
		useFileShortcut({
			isTextareaFocused: args.isTextareaFocused,
			onOpen,
			onSave,
		});
		return null;
	}

	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	root.render(createElement(Wrapper));

	return {
		onOpen,
		onSave,
		rerender(next: RenderArgs) {
			setPropsRef?.(next);
		},
		unmount() {
			root.unmount();
			container.remove();
		},
	};
}

function dispatchKey(options: {
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	key: string;
}): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
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

/** Drain microtasks so React's `useEffect` has registered its listener. */
function flushEffects(): Promise<void> {
	let chain = Promise.resolve();
	for (let i = 0; i < 3; i += 1) {
		chain = chain.then(
			() =>
				new Promise<void>((resolve) => {
					setTimeout(resolve, 0);
				})
		);
	}
	return chain;
}

describe('useFileShortcut', () => {
	test('⌘+S invokes onSave and prevents the browser page-save', async () => {
		withHappyDom();
		const { onSave, onOpen, unmount } = renderHook({
			isTextareaFocused: () => false,
		});
		await flushEffects();

		const event = dispatchKey({ key: 's', metaKey: true });

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onOpen).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
		unmount();
	});

	test('Ctrl+S invokes onSave and prevents the browser page-save', async () => {
		withHappyDom();
		const { onSave, onOpen, unmount } = renderHook({
			isTextareaFocused: () => false,
		});
		await flushEffects();

		const event = dispatchKey({ ctrlKey: true, key: 's' });

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onOpen).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
		unmount();
	});

	test('⌘+O invokes onOpen and prevents the browser page-open', async () => {
		withHappyDom();
		const { onSave, onOpen, unmount } = renderHook({
			isTextareaFocused: () => false,
		});
		await flushEffects();

		const event = dispatchKey({ key: 'o', metaKey: true });

		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(onSave).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
		unmount();
	});

	test('Ctrl+O invokes onOpen and prevents the browser page-open', async () => {
		withHappyDom();
		const { onSave, onOpen, unmount } = renderHook({
			isTextareaFocused: () => false,
		});
		await flushEffects();

		const event = dispatchKey({ ctrlKey: true, key: 'o' });

		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(onSave).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
		unmount();
	});

	test('does not invoke Save when a textarea is focused (native typing wins)', () => {
		withHappyDom();
		const { onSave, onOpen, unmount } = renderHook({
			isTextareaFocused: () => true,
		});

		const event = dispatchKey({ key: 's', metaKey: true });

		expect(onSave).not.toHaveBeenCalled();
		expect(onOpen).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
		unmount();
	});

	test('does not invoke Open when a textarea is focused', () => {
		withHappyDom();
		const { onSave, onOpen, unmount } = renderHook({
			isTextareaFocused: () => true,
		});

		const event = dispatchKey({ key: 'o', metaKey: true });

		expect(onSave).not.toHaveBeenCalled();
		expect(onOpen).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
		unmount();
	});

	test('ignores unrelated modifier-prefixed keys', () => {
		withHappyDom();
		const { onSave, onOpen, unmount } = renderHook({
			isTextareaFocused: () => false,
		});

		dispatchKey({ key: 'a', metaKey: true });
		dispatchKey({ ctrlKey: true, key: 'a' });
		dispatchKey({ key: 's' });

		expect(onSave).not.toHaveBeenCalled();
		expect(onOpen).not.toHaveBeenCalled();
		unmount();
	});

	test('detaches the listener on unmount', () => {
		withHappyDom();
		const { onSave, onOpen, unmount } = renderHook({
			isTextareaFocused: () => false,
		});

		unmount();
		dispatchKey({ key: 's', metaKey: true });
		dispatchKey({ key: 'o', metaKey: true });

		expect(onSave).not.toHaveBeenCalled();
		expect(onOpen).not.toHaveBeenCalled();
	});
});
