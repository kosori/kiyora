import { describe, expect, test } from 'bun:test';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExportFonts, FontReadiness } from './io/io';
import { EXPORT_FONTS_FIXTURE } from './test-fixtures';
import { withHappyDom } from './test-happy-dom';
import { useFontReadiness } from './use-font-readiness';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const FONTS: ExportFonts = EXPORT_FONTS_FIXTURE;

/** Default initializer for a deferred Promise resolve/reject slot. */
function noop(): void {
	// Intentionally empty: the slot is reassigned when the Promise
	// executor runs.
}

type HookRender = {
	rerender: (next: FontReadiness) => void;
	result: { current: ReturnType<typeof useFontReadiness> };
	unmount: () => void;
};

function renderWithReadiness(initial: FontReadiness): HookRender {
	withHappyDom();
	let setPropsRef: ((next: FontReadiness) => void) | null = null;
	const ref: {
		current: ReturnType<typeof useFontReadiness>;
	} = {
		current: { failure: null, fonts: null, ready: false },
	};

	function Wrapper(): null {
		const [readiness, setReadiness] = useState<FontReadiness>(initial);
		setPropsRef = setReadiness;
		ref.current = useFontReadiness(readiness);
		return null;
	}

	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	root.render(createElement(Wrapper));

	return {
		rerender(next) {
			setPropsRef?.(next);
		},
		result: ref,
		unmount() {
			root.unmount();
			container.remove();
		},
	};
}

/** Drain pending microtasks and yield to React's scheduler. */
function flush(): Promise<void> {
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

describe('useFontReadiness', () => {
	test('defers readiness.start to the mount effect, not render', async () => {
		let started = 0;
		const readiness: FontReadiness = {
			ready: new Promise<ExportFonts>(noop),
			start() {
				started += 1;
			},
		};
		const { result, unmount } = renderWithReadiness(readiness);

		// renderWithReadiness renders synchronously before the effect runs.
		expect(result.current.ready).toBe(false);
		expect(started).toBe(0);

		await flush();
		expect(started).toBe(1);
		unmount();
	});

	test('starts preparing (not ready) when the readiness promise is pending', () => {
		let resolveFn: (fonts: ExportFonts) => void = noop;
		const readiness: FontReadiness = {
			ready: new Promise<ExportFonts>((resolve) => {
				resolveFn = resolve;
			}),
			start: () => undefined,
		};
		const { result, unmount } = renderWithReadiness(readiness);
		expect(result.current.ready).toBe(false);
		expect(result.current.fonts).toBeNull();
		expect(result.current.failure).toBeNull();
		resolveFn(FONTS);
		unmount();
	});

	test('exposes the loaded fonts and flips ready once the promise resolves', async () => {
		let resolveFn: (fonts: ExportFonts) => void = noop;
		const readiness: FontReadiness = {
			ready: new Promise<ExportFonts>((resolve) => {
				resolveFn = resolve;
			}),
			start: () => undefined,
		};
		const { result, unmount } = renderWithReadiness(readiness);
		expect(result.current.ready).toBe(false);

		resolveFn(FONTS);
		await flush();

		expect(result.current.ready).toBe(true);
		expect(result.current.fonts).toBe(FONTS);
		expect(result.current.failure).toBeNull();
		unmount();
	});

	test('re-enables ready and captures the failure when the readiness promise rejects', async () => {
		let innerReject: (reason: Error) => void = noop;
		const inner = new Promise<ExportFonts>((_, reject) => {
			innerReject = reject;
		});
		const readiness: FontReadiness = { ready: inner, start: () => undefined };
		const { result, unmount } = renderWithReadiness(readiness);

		// Yield to React so the effect's `.then(_, _)` is registered.
		await flush();

		innerReject(new Error('font load failed'));
		await flush();

		// The action re-enables (spec: "re-enable the actions") while the
		// editor surfaces the rejection through the file-status footer.
		expect(result.current.ready).toBe(true);
		expect(result.current.fonts).toBeNull();
		expect(result.current.failure).toBe('font load failed');
		unmount();
	});

	test('re-subscribes to a new readiness when the prop changes', async () => {
		const first: FontReadiness = {
			ready: Promise.resolve(FONTS),
			start: () => undefined,
		};
		let resolveSecond: (fonts: ExportFonts) => void = noop;
		const second: FontReadiness = {
			ready: new Promise<ExportFonts>((resolve) => {
				resolveSecond = resolve;
			}),
			start: () => undefined,
		};

		const { result, rerender, unmount } = renderWithReadiness(first);
		await flush();
		expect(result.current.ready).toBe(true);
		expect(result.current.fonts).toBe(FONTS);
		expect(result.current.failure).toBeNull();

		rerender(second);
		await flush();
		expect(result.current.ready).toBe(false);
		expect(result.current.fonts).toBeNull();
		expect(result.current.failure).toBeNull();

		resolveSecond(FONTS);
		await flush();
		expect(result.current.ready).toBe(true);
		expect(result.current.fonts).toBe(FONTS);
		expect(result.current.failure).toBeNull();
		unmount();
	});
});
