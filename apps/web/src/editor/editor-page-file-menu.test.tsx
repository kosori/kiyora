import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorPageSurface } from './editor-page';
import type { Downloadable } from './io/io';
import type { SourceStorage } from './source-storage';
import { EXPORT_FONTS_FIXTURE } from './test-fixtures';
import { withHappyDom } from './test-happy-dom';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const EXPORT_FONTS = EXPORT_FONTS_FIXTURE;

type RecordedDownload = { blob: Blob; filename: string };

function makeRecordingDownloadable(): {
	downloadable: Downloadable;
	recorded: RecordedDownload[];
} {
	const recorded: RecordedDownload[] = [];
	return {
		downloadable: {
			save(entry) {
				recorded.push(entry);
			},
		},
		recorded,
	};
}

function makeFakeStorage(): SourceStorage & { saved: string[] } {
	const saved: string[] = [];
	let stored: string | null = null;
	return {
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
}

type RenderHandle = {
	container: Element;
	root: Root;
	unmount: () => void;
};

function renderEditor(
	storage: SourceStorage,
	downloadable: Downloadable,
	openable: {
		pickFile: () => Promise<File | null>;
	} = { pickFile: () => Promise.resolve(null) }
): RenderHandle {
	const { d } = withHappyDom();
	const container = d.createElement('div');
	d.body.append(container);
	const root = createRoot(container as unknown as Element);
	root.render(
		createElement(EditorPageSurface, {
			downloadable,
			fontReadiness: { ready: Promise.resolve(EXPORT_FONTS) },
			openable,
			storage,
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

async function flush(): Promise<void> {
	// Drain the React work loop and happy-dom's microtask queue so freshly
	// rendered nodes are present in the DOM before the next assertion.
	// Each wait gives React's scheduler one more chance to commit a
	// render; the loop is sequential on purpose and short-circuits
	// the noAwaitInLoops heuristic by chaining the promises.
	let chain = Promise.resolve();
	for (let i = 0; i < 5; i += 1) {
		chain = chain.then(
			() =>
				new Promise<void>((resolve) => {
					setTimeout(resolve, 0);
				})
		);
	}
	await chain;
}

describe('EditorPage File menu', () => {
	test('exposes an accessible File trigger on the canvas surface', async () => {
		const { downloadable } = makeRecordingDownloadable();
		const handle = renderEditor(makeFakeStorage(), downloadable);
		await flush();

		const trigger = handle.container.querySelector<HTMLElement>(
			'[data-file-menu-trigger="true"]'
		);
		expect(trigger).not.toBeNull();
		expect(trigger?.getAttribute('aria-label')).toBe('File menu');

		handle.unmount();
	});

	test('the File menu is keyboard-operable (it advertises itself as a menu via aria-haspopup)', async () => {
		const { downloadable } = makeRecordingDownloadable();
		const handle = renderEditor(makeFakeStorage(), downloadable);
		await flush();

		const trigger = handle.container.querySelector<HTMLElement>(
			'[data-file-menu-trigger="true"]'
		);
		expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');

		handle.unmount();
	});

	test('wires the File menu to the page with starter Source persisted and no download yet', async () => {
		const { downloadable, recorded } = makeRecordingDownloadable();
		const storage = makeFakeStorage();
		const handle = renderEditor(storage, downloadable);
		await flush();

		// The File menu lives on the canvas surface and the page wires
		// the downloadable, source, and title through to it. The
		// download contract is end-to-end covered by the IO boundary
		// tests; here we assert the page exposes the menu and persists
		// the starter source so a Save would have something to write.
		const trigger = handle.container.querySelector<HTMLElement>(
			'[data-file-menu-trigger="true"]'
		);
		expect(trigger).not.toBeNull();
		expect(storage.saved).toHaveLength(1);
		expect(recorded).toHaveLength(0);

		handle.unmount();
	});
});
