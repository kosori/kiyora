import { Canvas, type Editor } from '@kiyora/canvas/react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { FileMenu } from './file-menu';
import { type FitContainerSize, fitEditorToScene } from './fit-editor-to-scene';
import { Toolbar, type ToolbarContainerSize } from './toolbar';

export type CanvasHostProps = {
	editor: Editor;
	/** Bumped when the page wants the canvas to refit its viewport to the
	 * current scene, e.g. after a persisted Source is restored. */
	fitSignal?: number;
	/** True once the required font faces are loaded; controls the
	 * disabled state of the Export SVG and Export PNG menu items. */
	fontsReady: boolean;
	/** Measure the canvas host container. Defaults to the section's rect. */
	getContainerSize?: () => ToolbarContainerSize;
	/** Fired when the user picks Export PNG. The host does not own the
	 * scene snapshot — the page flushes Source, reads the editor's
	 * current Scene, and hands it to the I/O boundary. */
	onExportPng?: () => void;
	/** Fired when the user picks Export SVG. The host does not own the
	 * scene snapshot — the page flushes Source, reads the editor's
	 * current Scene, and hands it to the I/O boundary. */
	onExportSvg?: () => void;
	/** Fired when the user picks Open from the File menu. The page
	 * drives `openKira` and replaces Source when readKiraText resolves. */
	onOpen?: () => void;
	/** Fired when the user picks Save from the File menu. The page
	 * calls `downloadKira` with the latest Source. */
	onSave?: () => void;
};

/** Mount the interactive canvas and the toolbar overlay for an app-owned Editor. */
export function CanvasHost({
	editor,
	fitSignal = 0,
	fontsReady,
	getContainerSize,
	onExportPng,
	onExportSvg,
	onOpen,
	onSave,
}: CanvasHostProps) {
	const containerRef = useRef<HTMLElement | null>(null);
	const measure = useMeasure(containerRef);
	const getSize = getContainerSize ?? measure;

	// Fit-to-view is a one-shot policy: it runs once when the canvas is first
	// framed, once again when the page bumps `fitSignal` (a persisted Source
	// replaced the starter scene), and is never re-run on scene recompiles.
	// biome-ignore lint/correctness/useExhaustiveDependencies: one-shot policy
	useLayoutEffect(() => {
		fitEditorToScene(editor, getSize());
	}, [fitSignal]);

	return (
		<section
			aria-label='Diagram canvas'
			className='relative h-full min-h-0 min-w-0 bg-muted/20'
			ref={containerRef}
		>
			<Canvas
				aria-label='Diagram canvas'
				className='h-full min-h-0 w-full outline-none focus-visible:ring-2 focus-visible:ring-ring'
				editor={editor}
				showGrid
			/>
			<div className='pointer-events-auto absolute top-3 left-3 z-10'>
				<FileMenu
					fontsReady={fontsReady}
					onExportPng={onExportPng}
					onExportSvg={onExportSvg}
					onOpen={onOpen}
					onSave={onSave}
				/>
			</div>
			<Toolbar editor={editor} getContainerSize={getSize} />
		</section>
	);
}

function useMeasure(ref: {
	current: HTMLElement | null;
}): () => FitContainerSize {
	return useCallback(() => {
		const node = ref.current;
		if (node === null) {
			return { height: 0, width: 0 };
		}
		const rect = node.getBoundingClientRect();
		return { height: rect.height, width: rect.width };
	}, [ref]);
}
