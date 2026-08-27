import { Canvas, type Editor } from '@kiyora/canvas/react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { type FitContainerSize, fitEditorToScene } from './fit-editor-to-scene';
import { Toolbar, type ToolbarContainerSize } from './toolbar';

export type CanvasHostProps = {
	editor: Editor;
	/** Measure the canvas host container. Defaults to the section's rect. */
	getContainerSize?: () => ToolbarContainerSize;
};

/** Mount the interactive canvas and the toolbar overlay for an app-owned Editor. */
export function CanvasHost({ editor, getContainerSize }: CanvasHostProps) {
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
