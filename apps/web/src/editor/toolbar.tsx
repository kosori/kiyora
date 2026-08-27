import type { Editor } from '@kiyora/canvas/react';
import { Button } from '@kiyora/ui/button';
import {
	IconArrowBackUp,
	IconArrowForwardUp,
	IconArrowsMaximize,
	IconRotate,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type FitContainerSize, fitEditorToScene } from './fit-editor-to-scene';

export type ToolbarContainerSize = FitContainerSize;

export type ToolbarProps = {
	editor: Editor;
	getContainerSize: () => ToolbarContainerSize;
};

/** The undo/redo/zoom/reset overlay that sits on top of the canvas. */
export function Toolbar({ editor, getContainerSize }: ToolbarProps) {
	const viewport = useEditorViewport(editor);
	const { zoom } = viewport;

	const handleUndo = useCallback(() => editor.undo(), [editor]);
	const handleRedo = useCallback(() => editor.redo(), [editor]);
	const handleResetView = useCallback(() => editor.resetView(), [editor]);
	const handleFit = useCallback(() => {
		fitEditorToScene(editor, getContainerSize());
	}, [editor, getContainerSize]);

	const zoomLabel = useMemo(() => formatZoomPercent(zoom), [zoom]);

	return (
		<div
			aria-label='Canvas toolbar'
			className='pointer-events-auto absolute top-3 right-3 z-10 flex items-center gap-1 rounded-2xl border border-border bg-background/95 p-1 shadow-sm backdrop-blur'
			role='toolbar'
		>
			<Button
				aria-label='Undo'
				data-toolbar-action='undo'
				disabled={!editor.canUndo}
				onClick={handleUndo}
				size='icon-sm'
				variant='ghost'
			>
				<IconArrowBackUp aria-hidden='true' />
			</Button>
			<Button
				aria-label='Redo'
				data-toolbar-action='redo'
				disabled={!editor.canRedo}
				onClick={handleRedo}
				size='icon-sm'
				variant='ghost'
			>
				<IconArrowForwardUp aria-hidden='true' />
			</Button>
			<Button
				aria-label='Zoom to fit'
				data-toolbar-action='fit'
				onClick={handleFit}
				size='icon-sm'
				variant='ghost'
			>
				<IconArrowsMaximize aria-hidden='true' />
			</Button>
			<Button
				aria-label='Reset view'
				data-toolbar-action='reset'
				onClick={handleResetView}
				size='icon-sm'
				variant='ghost'
			>
				<IconRotate aria-hidden='true' />
			</Button>
			<span
				aria-label={`Zoom ${zoomLabel}`}
				className='min-w-12 px-2 text-center font-mono text-muted-foreground text-xs tabular-nums'
				data-toolbar-zoom
				role='status'
			>
				{zoomLabel}
			</span>
		</div>
	);
}

/** Re-render the host when the editor publishes a new snapshot. */
function useEditorViewport(editor: Editor): ReturnType<Editor['getViewport']> {
	const [snapshot, setSnapshot] = useState(() => editor.getSnapshot());
	useEffect(
		() => editor.subscribe(() => setSnapshot(editor.getSnapshot())),
		[editor]
	);
	return snapshot.viewport;
}

function formatZoomPercent(zoom: number): string {
	return `${Math.round(zoom * 100)}%`;
}
