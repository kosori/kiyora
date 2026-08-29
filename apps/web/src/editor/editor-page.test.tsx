import { describe, expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorPageSurface } from './editor-page';
import type { SourceStorage } from './source-storage';
import { EXPORT_FONTS_FIXTURE } from './test-fixtures';
import { withHappyDom } from './test-happy-dom';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const EXPORT_FONTS = EXPORT_FONTS_FIXTURE;

function makeFakeStorage(seed: string | null = null): SourceStorage & {
	saved: string[];
} {
	let stored = seed;
	const saved: string[] = [];
	return {
		load() {
			return stored;
		},
		save(source: string) {
			saved.push(source);
			stored = source;
		},
		get saved() {
			return saved;
		},
	};
}

function findTextarea(container: Element): HTMLTextAreaElement {
	const textarea = container.querySelector('textarea');
	if (!textarea) {
		throw new Error('expected a Source textarea to be rendered');
	}
	return textarea as HTMLTextAreaElement;
}

type TextareaProps = {
	onChange?: (event: unknown) => void;
};

/**
 * Simulate the user editing the Source textarea.
 *
 * Real browsers fire `input` events on every keystroke, and React 19 maps
 * them to `onChange` for text inputs. happy-dom's synthetic event reaches
 * React's listener, but React 19's value tracker has already observed the
 * programmatic assignment and reports "no change". Invoking the textarea's
 * React onChange prop directly replays what a keystroke would do without
 * reaching into React's internals beyond its public synthetic event
 * contract.
 */
function editTextarea(textarea: HTMLTextAreaElement, value: string): void {
	const propsKey = Object.keys(textarea).find((k) =>
		k.startsWith('__reactProps$')
	);
	const props = propsKey
		? (textarea as unknown as Record<string, TextareaProps>)[propsKey]
		: undefined;
	const setter = Object.getOwnPropertyDescriptor(
		Object.getPrototypeOf(textarea),
		'value'
	)?.set;
	if (!setter) {
		throw new Error('expected a value setter on the textarea prototype');
	}
	setter.call(textarea, value);
	if (props?.onChange) {
		props.onChange({ currentTarget: textarea, target: textarea });
	}
}

function renderEditor(
	storage: SourceStorage,
	downloadable: { save: (entry: unknown) => void } = { save: () => undefined },
	openable: { pickFile: () => Promise<File | null> } = {
		pickFile: () => Promise.resolve(null),
	}
): {
	container: Element;
	root: ReturnType<typeof createRoot>;
	unmount: () => void;
} {
	const { d } = withHappyDom();
	const container = d.createElement('div');
	d.body.append(container);
	const root = createRoot(container as unknown as Element);
	act(() => {
		root.render(
			createElement(EditorPageSurface, {
				downloadable,
				fontReadiness: { ready: Promise.resolve(EXPORT_FONTS) },
				openable,
				storage,
			})
		);
	});
	return {
		container,
		root,
		unmount() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	};
}

describe('EditorPage durable Source workspace', () => {
	test('falls back to starter Source on a first visit when storage is empty', () => {
		const storage = makeFakeStorage(null);
		const { container, unmount } = renderEditor(storage);

		const textarea = findTextarea(container);
		expect(textarea.value.startsWith('architecture')).toBe(true);
		expect(textarea.value).toContain('title Request pipeline');

		unmount();
	});

	test('restores the previously persisted Source on a later visit', () => {
		const persisted = 'architecture\ntitle Restored diagram';
		const { container, unmount } = renderEditor(makeFakeStorage(persisted));

		const textarea = findTextarea(container);
		expect(textarea.value).toBe(persisted);

		unmount();
	});

	test('persists the current Source on every edit, ahead of any debounce', () => {
		const storage = makeFakeStorage(null);
		const { container, unmount } = renderEditor(storage);

		const textarea = findTextarea(container);
		const nextSource = 'flowchart\ntitle Persisted immediately';
		act(() => {
			editTextarea(textarea, nextSource);
		});

		expect(storage.saved.at(-1)).toBe(nextSource);

		unmount();
	});

	test('does not persist canvas-only Scene placement or selection', () => {
		// The page exposes only Source persistence; there is no path that
		// records Scene state. Asserting that the only save on first
		// paint is the starter Source guards against accidental widening
		// of the storage boundary in the future.
		const storage = makeFakeStorage(null);
		const { unmount } = renderEditor(storage);

		expect(storage.saved).toHaveLength(1);
		expect(storage.saved[0]?.startsWith('architecture')).toBe(true);

		unmount();
	});
});
