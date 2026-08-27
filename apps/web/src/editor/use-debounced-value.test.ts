import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { withHappyDom } from './test-happy-dom';
import { useDebouncedValue } from './use-debounced-value';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type HookArgs = Parameters<typeof useDebouncedValue>;

function renderHook(initialArgs: HookArgs): {
	rerender: (next: HookArgs) => void;
	result: { current: HookArgs[0] };
	unmount: () => void;
} {
	let setPropsRef: ((next: HookArgs) => void) | null = null;
	const ref: { current: HookArgs[0] } = { current: initialArgs[0] };

	function Wrapper(): null {
		const [args, setArgs] = useState<HookArgs>(initialArgs);
		setPropsRef = setArgs;
		ref.current = useDebouncedValue(...args);
		return null;
	}

	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	act(() => {
		root.render(createElement(Wrapper));
	});

	return {
		rerender(next: HookArgs) {
			act(() => {
				setPropsRef?.(next);
			});
		},
		result: ref,
		unmount() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	};
}

type FakeTimer = { handler: () => void; id: number; ms: number };

let timers: FakeTimer[] = [];
let nextId = 0;
let realSetTimeout: typeof setTimeout;
let realClearTimeout: typeof clearTimeout;

beforeEach(() => {
	withHappyDom();
	timers = [];
	nextId = 0;
	realSetTimeout = globalThis.setTimeout;
	realClearTimeout = globalThis.clearTimeout;
	const fakeSet = ((handler: () => void, ms = 0): number => {
		nextId += 1;
		const id = nextId;
		timers.push({ handler, id, ms });
		return id;
	}) as unknown as typeof setTimeout;
	const fakeClear = ((id: number): void => {
		timers = timers.filter((t) => t.id !== id);
	}) as unknown as typeof clearTimeout;
	globalThis.setTimeout = fakeSet;
	globalThis.clearTimeout = fakeClear;
});

afterEach(() => {
	timers = [];
	globalThis.setTimeout = realSetTimeout;
	globalThis.clearTimeout = realClearTimeout;
});

function advanceBy(ms: number): void {
	let remaining = ms;
	// Drain timers in chronological order. Each drained timer fires its
	// handler synchronously, which can schedule more timers; we keep
	// subtracting from `remaining` until we've covered the requested window
	// or no timers are due.
	for (;;) {
		const due = timers
			.filter((t) => t.ms <= remaining)
			.sort((a, b) => a.ms - b.ms);
		const [next] = due;
		if (next === undefined) {
			timers = timers.map((t) => ({ ...t, ms: t.ms - remaining }));
			return;
		}
		remaining -= next.ms;
		timers = timers.filter((t) => t.id !== next.id);
		next.handler();
	}
}

describe('useDebouncedValue', () => {
	test('returns the initial value synchronously', () => {
		const { result, unmount } = renderHook(['initial', 250]);
		expect(result.current).toBe('initial');
		unmount();
	});

	test('does not publish updates before the delay elapses', () => {
		const { result, rerender, unmount } = renderHook(['a', 250]);

		rerender(['b', 250]);
		expect(result.current).toBe('a');

		act(() => {
			advanceBy(249);
		});
		expect(result.current).toBe('a');
		unmount();
	});

	test('publishes the latest value once the delay elapses', () => {
		const { result, rerender, unmount } = renderHook(['a', 250]);

		rerender(['b', 250]);
		rerender(['c', 250]);
		act(() => {
			advanceBy(250);
		});

		expect(result.current).toBe('c');
		unmount();
	});

	test('restarts the delay when the value changes mid-flight', () => {
		const { result, rerender, unmount } = renderHook(['a', 250]);

		rerender(['b', 250]);
		act(() => {
			advanceBy(200);
		});
		rerender(['c', 250]);

		// 50ms after the second change is not enough.
		act(() => {
			advanceBy(50);
		});
		expect(result.current).toBe('a');

		// 200ms more (250ms after the second change) is enough.
		act(() => {
			advanceBy(200);
		});
		expect(result.current).toBe('c');
		unmount();
	});

	test('cancels the pending update on unmount', () => {
		const { result, rerender, unmount } = renderHook(['a', 250]);

		rerender(['b', 250]);
		unmount();
		act(() => {
			advanceBy(1000);
		});

		expect(result.current).toBe('a');
	});
});
