import { describe, expect, mock, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorPageSurface } from './editor-page';
import type { Downloadable, PngRasterizer } from './io/io';
import type { SourceStorage } from './source-storage';
import { EXPORT_FONTS_FIXTURE } from './test-fixtures';
import { withHappyDom } from './test-happy-dom';

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const EXPORT_FONTS = EXPORT_FONTS_FIXTURE;

type Recording = {
	downloadable: Downloadable & { recorded: { blob: Blob; filename: string }[] };
	rasterizer: PngRasterizer & { calls: { height: number; width: number }[] };
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
	const calls: { height: number; width: number }[] = [];
	const rasterizer: PngRasterizer & {
		calls: { height: number; width: number }[];
	} = {
		calls,
		rasterize: mock(({ height, width }) => {
			calls.push({ height, width });
			return Promise.resolve(new Blob(['PNG'], { type: 'image/png' }));
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
	return { downloadable, rasterizer, storage };
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
	act(() => {
		root.render(
			createElement(EditorPageSurface, {
				downloadable: recording.downloadable,
				fontReadiness: { ready: Promise.resolve(EXPORT_FONTS) },
				openable: { pickFile: () => Promise.resolve(null) },
				rasterizer: recording.rasterizer,
				storage: recording.storage,
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

async function flush(): Promise<void> {
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

describe('EditorPage Export PNG wiring', () => {
	test('mounting the editor never rasterizes a PNG on its own', async () => {
		const recording = makeRecording();
		const handle = renderEditor(recording);
		await flush();

		// The Export PNG action lives behind a user click in the File
		// menu. The editor must not trigger any rasterization on mount
		// — only an explicit Export PNG action should.
		expect(recording.rasterizer.calls).toHaveLength(0);
		expect(recording.downloadable.recorded).toHaveLength(0);

		handle.unmount();
	});

	test('the editor mounts cleanly with the rasterizer seam wired through', async () => {
		const recording = makeRecording();
		const handle = renderEditor(recording);
		await flush();

		// The trigger button stays available so the user can reach the
		// Export PNG action once fonts are ready.
		const trigger = handle.container.querySelector<HTMLElement>(
			'[data-file-menu-trigger="true"]'
		);
		expect(trigger).not.toBeNull();
		expect(
			handle.container.querySelector('[data-file-status-error]')
		).toBeNull();

		handle.unmount();
	});
});
