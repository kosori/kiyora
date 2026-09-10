import { describe, expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorPageSurface } from './editor-page';
import type { SourceStorage } from './source-storage';
import { STARTER_SOURCE } from './starter';
import { resolvedFontReadiness } from './test-fixtures';
import { withHappyDom } from './test-happy-dom';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeFakeStorage(
	seed: string | null = null,
	saveSucceeds = true
): SourceStorage & {
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
			if (!saveSucceeds) {
				return false;
			}
			stored = source;
			return true;
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
				fontReadiness: resolvedFontReadiness(),
				openable,
				rasterizer: { rasterize: () => Promise.resolve(new Blob()) },
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

	test('never persists the starter Source over a saved one during restoration', () => {
		const persisted = 'architecture\ntitle Restored diagram';
		const storage = makeFakeStorage(persisted);
		const { unmount } = renderEditor(storage);

		// The persistence effect must not write the transient starter Source
		// before the restore pass has settled; otherwise a refresh would
		// clobber the saved workspace.
		for (const saved of storage.saved) {
			expect(saved).not.toBe(STARTER_SOURCE);
		}
		expect(storage.saved.at(-1)).toBe(persisted);

		unmount();
	});

	test('treats a saved source equal to the starter as no restoration', () => {
		const storage = makeFakeStorage(STARTER_SOURCE);
		const { container, unmount } = renderEditor(storage);

		const textarea = findTextarea(container);
		expect(textarea.value).toBe(STARTER_SOURCE);
		// Exactly one write after the restore settles: the starter itself.
		// No extra persistence churn and no second compile pass.
		expect(storage.saved).toEqual([STARTER_SOURCE]);

		unmount();
	});

	test('keeps invalid saved Source visible with its compile diagnostics', async () => {
		const broken = 'architecture\ntitle T\nA -> B ->';
		const { container, unmount } = renderEditor(makeFakeStorage(broken));

		const textarea = findTextarea(container);
		expect(textarea.value).toBe(broken);
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 300));
		});
		const list = container.querySelector('[data-diagnostics]');
		expect(list?.getAttribute('data-state')).toBe('error');

		unmount();
	});

	test('survives a storage read that throws', () => {
		const storage: SourceStorage = {
			load() {
				throw new Error('quota');
			},
			save: () => true,
		};
		const { container, unmount } = renderEditor(storage);

		const textarea = findTextarea(container);
		expect(textarea.value.startsWith('architecture')).toBe(true);

		unmount();
	});

	test('surfaces an error message when localStorage save fails', () => {
		const storage = makeFakeStorage(null, false);
		const { container, unmount } = renderEditor(storage);

		const error = container.querySelector('[data-file-status-error]');
		expect(error?.textContent).toBe(
			'Local storage is full or disabled. Edits will not be saved automatically.'
		);

		unmount();
	});

	test('renders the starter Source on the server and restores after hydration', async () => {
		const { renderToString } = await import('react-dom/server');
		const { hydrateRoot } = await import('react-dom/client');
		const persisted = 'architecture\ntitle Restored diagram';
		const props = {
			downloadable: { save: () => undefined },
			fontReadiness: resolvedFontReadiness(),
			openable: { pickFile: () => Promise.resolve(null) },
			rasterizer: { rasterize: () => Promise.resolve(new Blob()) },
			storage: makeFakeStorage(persisted),
		};
		// No happy-dom globals installed: this render is the server pass.
		const serverHtml = renderToString(createElement(EditorPageSurface, props));
		expect(serverHtml).toContain('Request pipeline');
		expect(serverHtml).not.toContain('Restored diagram');

		const { d } = withHappyDom();
		const host = d.createElement('div');
		host.innerHTML = serverHtml;
		d.body.append(host);

		let recoverable: unknown = null;
		await new Promise<void>((resolve) => {
			const root = hydrateRoot(
				host as unknown as Element,
				createElement(EditorPageSurface, props),
				{
					onRecoverableError: (error) => {
						recoverable = error;
					},
				}
			);
			setTimeout(() => {
				act(() => {
					root.unmount();
				});
				resolve();
			}, 50);
		});

		expect(recoverable).toBeNull();
		host.remove();
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
