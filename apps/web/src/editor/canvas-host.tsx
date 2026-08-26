import type { Editor } from '@kiyora/canvas/react';
import { Canvas } from '@kiyora/canvas/react';

export type CanvasHostProps = {
	editor: Editor;
};

/** Mount the interactive canvas for the app-owned Editor. */
export function CanvasHost({ editor }: CanvasHostProps) {
	return (
		<section
			aria-label='Diagram canvas'
			className='h-full min-h-0 min-w-0 bg-muted/20'
		>
			<Canvas className='h-full min-h-0 w-full' editor={editor} showGrid />
		</section>
	);
}
