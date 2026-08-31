import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorPageSurface } from './editor-page';
import type { Downloadable, ExportFonts } from './io/io';
import type { SourceStorage } from './source-storage';
import { EXPORT_FONTS_FIXTURE } from './test-fixtures';
import { withHappyDom } from './test-happy-dom';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const EXPORT_FONTS = EXPORT_FONTS_FIXTURE;

type Recording = {
	downloadable: Downloadable & { recorded: { blob: Blob; filename: string }[] };
	fontReadiness: { ready: Promise<ExportFonts> };
	storage: SourceStorage & { saved: string[] };
};

type FailingRecording = Recording & {
	rejectReady: (reason: Error) => void;
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
	return {
		downloadable,
		fontReadiness: { ready: Promise.resolve(EXPORT_FONTS) },
		storage,
	};
}

function makePendingRecording(): Recording {
	return {
		...makeRecording(),
		fontReadiness: {
			ready: new Promise<ExportFonts>(noop),
		},
	};
}

function makeFailingRecording(): FailingRecording {
	const recorded = makeRecording();
	let innerReject: (reason: Error) => void = noop;
	const inner = new Promise<ExportFonts>((_, reject) => {
		innerReject = reject;
	});
	const recording: FailingRecording = {
		...recorded,
		fontReadiness: { ready: inner },
		rejectReady: (reason) => innerReject(reason),
	};
	return recording;
}

/** Default initializer for a deferred Promise resolve slot. */
function noop(): void {
	// Intentionally empty: the slot is reassigned when the Promise
	// executor runs.
}

type RenderHandle = {
	container: Element;
	root: ReturnType<typeof createRoot>;
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
			fontReadiness: recording.fontReadiness,
			openable: { pickFile: () => Promise.resolve(null) },
			rasterizer: { rasterize: () => Promise.resolve(new Blob()) },
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

describe('EditorPage Export SVG wiring', () => {
	test('the File menu trigger stays available while fonts are preparing', async () => {
		const recording = makePendingRecording();
		const handle = renderEditor(recording);
		await flush();

		// Save and Open remain reachable during font preparation. The
		// Export SVG action is gated at the menu item below.
		const trigger = handle.container.querySelector<HTMLElement>(
			'[data-file-menu-trigger="true"]'
		);
		expect(trigger).not.toBeNull();
		expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');

		// No download has happened yet because no action fired.
		expect(recording.downloadable.recorded).toHaveLength(0);
		expect(
			handle.container.querySelector('[data-file-status-error]')
		).toBeNull();

		handle.unmount();
	});

	test('a resolved font readiness does not trigger a download on its own', async () => {
		const recording = makeRecording();
		const handle = renderEditor(recording);
		await flush();

		// Mounting the editor with resolved readiness must not trigger
		// any download; only an explicit user action does.
		expect(recording.downloadable.recorded).toHaveLength(0);

		handle.unmount();
	});

	test('a font-readiness rejection re-enables the editor and surfaces the failure as a file-status error', async () => {
		const recording = makeFailingRecording();
		const handle = renderEditor(recording);
		await flush();

		// Yield once more so the editor's effect registers its
		// `.then(_, _)` handler before we settle the promise.
		await flush();

		recording.rejectReady(new Error('woff2 fetch failed'));
		await flush();

		// After the readiness settles (in failure), the editor surfaces
		// the rejection through the file-status footer so the user sees
		// why exports are not happening.
		const errorRegion = handle.container.querySelector(
			'[data-file-status-error]'
		);
		expect(errorRegion).not.toBeNull();
		expect(errorRegion?.getAttribute('role')).toBe('alert');
		expect(errorRegion?.textContent).toContain('woff2 fetch failed');

		// No download is produced — the failure stays at the
		// file-operation layer, not the DSL diagnostic layer.
		expect(recording.downloadable.recorded).toHaveLength(0);
		expect(
			handle.container.querySelector('[data-diagnostics-list]')
		).toBeNull();

		handle.unmount();
	});
});
