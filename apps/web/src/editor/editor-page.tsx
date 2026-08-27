import { createEditor } from '@kiyora/canvas/react';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@kiyora/ui/resizable';
import { useCallback, useEffect, useState } from 'react';
import { CanvasHost } from './canvas-host';
import { CodePanel } from './code-panel';
import { parseAndCompile } from './parse-and-compile';
import { STARTER_SOURCE } from './starter';
import { useEditorKeyboardShortcuts } from './use-editor-keyboard-shortcuts';

/** The split-pane Source editor and interactive canvas surface. */
export function EditorPage() {
	const [source, setSource] = useState(STARTER_SOURCE);
	const [editor] = useState(() =>
		createEditor(parseAndCompile(STARTER_SOURCE).scene)
	);

	useEffect(() => {
		const { scene } = parseAndCompile(source);
		editor.setScene(scene);
	}, [editor, source]);

	const isTextareaFocused = useCallback(
		() =>
			typeof document !== 'undefined' &&
			document.activeElement?.tagName === 'TEXTAREA',
		[]
	);
	useEditorKeyboardShortcuts(editor, { isTextareaFocused });

	return (
		<main className='h-svh min-h-0 overflow-hidden'>
			<ResizablePanelGroup orientation='horizontal'>
				<ResizablePanel defaultSize='35%' minSize='20%'>
					<CodePanel onSourceChange={setSource} source={source} />
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize='65%' minSize='30%'>
					<CanvasHost editor={editor} />
				</ResizablePanel>
			</ResizablePanelGroup>
		</main>
	);
}
