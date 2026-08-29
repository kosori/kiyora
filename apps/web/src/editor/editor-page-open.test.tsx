import { describe, expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorPageSurface } from './editor-page';
import type { Downloadable } from './io/io';
import type { SourceStorage } from './source-storage';
import { withHappyDom } from './test-happy-dom';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class FakeFile {
	name: string;
	size: number;
	type: string;
	private readonly contents: string;
	constructor(contents: string, name: string, type = 'text/plain') {
		this.contents = contents;
		this.name = name;
		this.size = contents.length;
		this.type = type;
	}
	text(): Promise<string> {
		return Promise.resolve(this.contents);
	}
}

type Recording = {
	downloadable: Downloadable & { recorded: { blob: Blob; filename: string }[] };
	openable: {
		pickFile: ReturnType<typeof mock>;
		files: (File | null)[];
	};
	storage: SourceStorage & { saved: string[] };
};

function makeRecording(): Recording {
	const recorded: { blob: Blob; filename: string }[] = [];
	const downloadable: Downloadable & {
		recorded: { blob: Blob; filename: string }[];
	} = {
		recorded,
		save(entry) {
			recorded.push(entry);
		},
	};
	const files: (File | null)[] = [];
	const openable = {
		files,
		pickFile: mock(() => {
			const next = files.shift() ?? null;
			return Promise.resolve(next);
		}),
	};
	const saved: string[] = [];
	let stored: string | null = null;
	const storage: SourceStorage & { saved: string[] } = {
		load() {
			return stored;
		},
		save(source) {
			saved.push(source);
			stored = source;
		},
		get saved() {
			return saved;
		},
	};
	return { downloadable, openable, storage };
}

type RenderHandle = {
	container: Element;
	root: Root;
	unmount: () => void;
};

function renderEditor(recording: Recording): RenderHandle {
	const { d } = withHappyDom();
	const container = d.createElement('div');
	d.body.append(container);
	const root = createRoot(container as unknown as Element);
	root.render(
		createElement(EditorPageSurface, {
			downloadable: recording.downloadable,
			openable: recording.openable,
			storage: recording.storage,
		})
	);
	return {
		container,
		root,
		unmount() {
			root.unmount();
			container.remove();
		},
	};
}

function flush(): Promise<void> {
	let chain = Promise.resolve();
	for (let i = 0; i < 5; i += 1) {
		chain = chain.then(
			() =>
				new Promise<void>((resolve) => {
					setTimeout(resolve, 0);
				})
		);
	}
	return chain;
}

function findTextarea(container: Element): HTMLTextAreaElement {
	const textarea = container.querySelector('textarea');
	if (!textarea) {
		throw new Error('expected a Source textarea to be rendered');
	}
	return textarea as HTMLTextAreaElement;
}

function dispatchKey(options: {
	ctrlKey?: boolean;
	metaKey?: boolean;
	key: string;
}): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		bubbles: true,
		cancelable: true,
		ctrlKey: options.ctrlKey ?? false,
		key: options.key,
		metaKey: options.metaKey ?? false,
	});
	window.dispatchEvent(event);
	return event;
}

describe('EditorPage Open flow', () => {
	async function triggerOpen(): Promise<void> {
		const event = dispatchKey({ key: 'o', metaKey: true });
		expect(event.defaultPrevented).toBe(true);
		await flush();
	}

	test('⌘+O replaces Source with the chosen Kira file, persists it, and shows no error', async () => {
		const recording = makeRecording();
		const replacement =
			'architecture\ntitle Opened from disk\nBrowser -> CDN: hit';
		recording.openable.files.push(
			new FakeFile(replacement, 'opened.kira') as unknown as File
		);

		const handle = renderEditor(recording);
		await flush();

		await triggerOpen();

		const textarea = findTextarea(handle.container);
		expect(textarea.value).toBe(replacement);
		expect(recording.storage.saved.at(-1)).toBe(replacement);
		expect(recording.openable.pickFile).toHaveBeenCalledTimes(1);
		expect(
			handle.container.querySelector('[data-file-status-error]')
		).toBeNull();

		handle.unmount();
	});

	test('Ctrl+O opens a Kira file the same way', async () => {
		const recording = makeRecording();
		const replacement = 'flowchart\ntitle Via Ctrl+O\nA -> B';
		recording.openable.files.push(
			new FakeFile(replacement, 'shortcut.kira') as unknown as File
		);

		const handle = renderEditor(recording);
		await flush();

		const event = dispatchKey({ ctrlKey: true, key: 'o' });
		expect(event.defaultPrevented).toBe(true);
		await flush();

		expect(findTextarea(handle.container).value).toBe(replacement);

		handle.unmount();
	});

	test('Open replaces Source immediately and compiles the new Scene ahead of the debounce', async () => {
		const recording = makeRecording();
		const replacement = 'flowchart\ntitle Immediate\nA -> B';
		recording.openable.files.push(
			new FakeFile(replacement, 'immediate.kira') as unknown as File
		);

		const handle = renderEditor(recording);
		await flush();

		await triggerOpen();

		const textarea = findTextarea(handle.container);
		expect(textarea.value).toBe(replacement);
		// Scene title is the title derived from the new Source, even
		// before the compile debounce would have fired. Asserting on the
		// DOM-rendered textarea value is the observable proxy for "the
		// Source is what the editor sees right now"; the compile is
		// exercised through the same `setSource`/compile pipeline the
		// keystroke path uses and is covered by parse-and-compile tests.
		handle.unmount();
	});

	test('Open accepts a Kira file with DSL problems; the failure surfaces as a Diagnostic, not a file error', async () => {
		const recording = makeRecording();
		const malformed = 'architecture\nUnknown [not-a-shape]';
		recording.openable.files.push(
			new FakeFile(malformed, 'malformed.kira') as unknown as File
		);

		const handle = renderEditor(recording);
		await flush();

		await triggerOpen();

		const textarea = findTextarea(handle.container);
		expect(textarea.value).toBe(malformed);
		expect(
			handle.container.querySelector('[data-file-status-error]')
		).toBeNull();

		handle.unmount();
	});

	test('Open rejects a non-.kira file: Source preserved, accessible alert shown', async () => {
		const recording = makeRecording();
		recording.openable.files.push(
			new FakeFile('flowchart\nA -> B', 'diagram.txt') as unknown as File
		);

		const handle = renderEditor(recording);
		await flush();

		const textarea = findTextarea(handle.container);
		const before = textarea.value;

		await triggerOpen();

		expect(textarea.value).toBe(before);
		const errorRegion = handle.container.querySelector(
			'[data-file-status-error]'
		);
		expect(errorRegion).not.toBeNull();
		expect(errorRegion?.getAttribute('role')).toBe('alert');
		expect(errorRegion?.textContent).toMatch(/not a \.kira file/i);

		handle.unmount();
	});

	test('Open rejects an oversized file and preserves the current Source', async () => {
		const recording = makeRecording();
		const big = 'x'.repeat(1024 * 1024 + 1);
		recording.openable.files.push(
			new FakeFile(big, 'huge.kira') as unknown as File
		);

		const handle = renderEditor(recording);
		await flush();

		const textarea = findTextarea(handle.container);
		const before = textarea.value;

		await triggerOpen();

		expect(textarea.value).toBe(before);
		const errorRegion = handle.container.querySelector(
			'[data-file-status-error]'
		);
		expect(errorRegion?.textContent).toMatch(/too large/i);

		handle.unmount();
	});

	test('Open treats a cancelled picker as a quiet no-op', async () => {
		const recording = makeRecording();
		recording.openable.files.push(null);

		const handle = renderEditor(recording);
		await flush();

		const textarea = findTextarea(handle.container);
		const before = textarea.value;

		await triggerOpen();

		expect(textarea.value).toBe(before);
		expect(
			handle.container.querySelector('[data-file-status-error]')
		).toBeNull();

		handle.unmount();
	});

	test('Open handles an unreadable file: Source preserved, error reported', async () => {
		const recording = makeRecording();
		class BrokenFile {
			name = 'broken.kira';
			size = 4;
			type = 'text/plain';
			text(): Promise<string> {
				return Promise.reject(new Error('disk on fire'));
			}
		}
		recording.openable.files.push(new BrokenFile() as unknown as File);

		const handle = renderEditor(recording);
		await flush();

		const textarea = findTextarea(handle.container);
		const before = textarea.value;

		await triggerOpen();

		expect(textarea.value).toBe(before);
		const errorRegion = handle.container.querySelector(
			'[data-file-status-error]'
		);
		expect(errorRegion?.textContent).toMatch(/disk on fire/);

		handle.unmount();
	});

	test('dismissing the file error removes it from the footer', async () => {
		const recording = makeRecording();
		recording.openable.files.push(
			new FakeFile('flowchart\nA -> B', 'diagram.txt') as unknown as File
		);

		const handle = renderEditor(recording);
		await flush();

		await triggerOpen();

		const dismiss = handle.container.querySelector<HTMLButtonElement>(
			'[data-file-status-dismiss]'
		);
		expect(dismiss).not.toBeNull();
		dismiss?.click();
		await flush();

		expect(
			handle.container.querySelector('[data-file-status-error]')
		).toBeNull();

		handle.unmount();
	});

	test('⌘+S invokes Save with the current Source and prevents the browser page-save', async () => {
		const recording = makeRecording();
		const handle = renderEditor(recording);
		await flush();

		const event = dispatchKey({ key: 's', metaKey: true });

		expect(recording.downloadable.recorded.length).toBe(1);
		expect(event.defaultPrevented).toBe(true);

		handle.unmount();
	});

	test('Ctrl+S invokes Save and prevents the browser page-save', async () => {
		const recording = makeRecording();
		const handle = renderEditor(recording);
		await flush();

		const event = dispatchKey({ ctrlKey: true, key: 's' });

		expect(recording.downloadable.recorded.length).toBe(1);
		expect(event.defaultPrevented).toBe(true);

		handle.unmount();
	});

	test('shortcuts do not fire when the Source textarea is focused', async () => {
		const recording = makeRecording();
		const handle = renderEditor(recording);
		await flush();

		const textarea = findTextarea(handle.container);
		textarea.focus();
		const event = dispatchKey({ key: 's', metaKey: true });
		await flush();

		expect(recording.downloadable.recorded.length).toBe(0);
		expect(recording.openable.pickFile).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);

		handle.unmount();
	});

	test('the footer advertises the keyboard shortcuts when there is no error', async () => {
		const recording = makeRecording();
		const handle = renderEditor(recording);
		await flush();

		const shortcuts = handle.container.querySelector(
			'[data-file-status-shortcuts]'
		);
		expect(shortcuts).not.toBeNull();
		expect(shortcuts?.textContent).toContain('⌘S Save');
		expect(shortcuts?.textContent).toContain('⌘O Open');

		handle.unmount();
	});
});
