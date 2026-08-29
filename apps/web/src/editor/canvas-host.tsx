import { Canvas, type Editor } from '@kiyora/canvas/react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { FileMenu } from './file-menu';
import { type FitContainerSize, fitEditorToScene } from './fit-editor-to-scene';
import type { Downloadable } from './io/io';
import { Toolbar, type ToolbarContainerSize } from './toolbar';

export type CanvasHostProps = {
	/** Where the Save Blob lands. The host owns the I/O seam so the page
	 * never has to know about browser downloads. */
	downloadable: Downloadable;
	editor: Editor;
	/** Measure the canvas host container. Defaults to the section's rect. */
	getContainerSize?: () => ToolbarContainerSize;
	/** Fired after a successful Save. */
	onSave?: (source: string) => void;
	/** The current Kiyora Source. Read at Save click time so the latest
	 * edit is what leaves the browser. */
	source: string;
	/** The current Diagram title, derived from the current Source. */
	title: string;
};

/** Mount the interactive canvas and the toolbar overlay for an app-owned Editor. */
export function CanvasHost({
	downloadable,
	editor,
	getContainerSize,
	onSave,
	source,
	title,
}: CanvasHostProps) {
	const containerRef = useRef<HTMLElement | null>(null);
	const measure = useMeasure(containerRef);
	const getSize = getContainerSize ?? measure;

	// Fit-to-view is a one-shot policy: it runs once when the canvas is first
	// framed and is never re-run on scene recompiles.
	// biome-ignore lint/correctness/useExhaustiveDependencies: one-shot policy
	useLayoutEffect(() => {
		fitEditorToScene(editor, getSize());
	}, []);

	return (
		<section
			aria-label='Diagram canvas'
			className='relative h-full min-h-0 min-w-0 bg-muted/20'
			ref={containerRef}
		>
			<Canvas className='h-full min-h-0 w-full' editor={editor} showGrid />
			<div className='pointer-events-auto absolute top-3 left-3 z-10'>
				<FileMenu
					downloadable={downloadable}
					onSave={onSave}
					source={source}
					title={title}
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
