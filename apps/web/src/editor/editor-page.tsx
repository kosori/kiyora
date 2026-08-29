import { createEditor, type Editor } from '@kiyora/canvas/react';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@kiyora/ui/resizable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasHost } from './canvas-host';
import { CodePanel } from './code-panel';
import { DiagnosticsList } from './diagnostics-list';
import { parseAndCompile } from './parse-and-compile';
import { scrollTextareaToLine } from './scroll-textarea-to-line';
import { selectionToLine } from './selection-to-line';
import { browserSourceStorage, type SourceStorage } from './source-storage';
import { STARTER_SOURCE } from './starter';
import { useCompileShortcut } from './use-compile-shortcut';
import { useDebouncedValue } from './use-debounced-value';
import { useEditorKeyboardShortcuts } from './use-editor-keyboard-shortcuts';

const COMPILE_DEBOUNCE_MS = 250;

/**
 * The split-pane Source editor and interactive canvas surface.
 *
 * Source is the textual interchange format and the only thing this page
 * persists. Canvas-only Scene placement, selection, and the Viewport are
 * transient: a fresh compile from the restored Source produces a new
 * Scene, and the canvas host's one-shot fit-to-view frames it on mount.
 */
export function EditorPage() {
	return <EditorPageSurface storage={useMemo(browserSourceStorage, [])} />;
}

export type EditorPageSurfaceProps = {
	storage: SourceStorage;
};

/**
 * The testable surface behind `EditorPage`. Accepts an injected Source
 * storage so the editor-page tests can replace the browser boundary with
 * a controlled fake and observe initial fallback, restore, and immediate
 * persistence without touching `localStorage`.
 */
export function EditorPageSurface({ storage }: EditorPageSurfaceProps) {
	const initialSource = storage.load() ?? STARTER_SOURCE;
	const [source, setSource] = useState(initialSource);
	const [editor] = useState<Editor>(() =>
		createEditor(parseAndCompile(initialSource).scene)
	);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	// The source string the editor was last applied with. Used to skip the
	// compile effect when neither the debounced value nor the immediate
	// compile produced a new scene.
	const lastCompiledSourceRef = useRef<string>(initialSource);
	const debouncedSource = useDebouncedValue(source, COMPILE_DEBOUNCE_MS);

	const diagnostics = useMemo(
		() => parseAndCompile(debouncedSource).diagnostics,
		[debouncedSource]
	);

	const applyCompile = useCallback(
		(nextSource: string) => {
			if (nextSource === lastCompiledSourceRef.current) {
				return;
			}
			const compiled = parseAndCompile(nextSource);
			editor.setScene(compiled.scene);
			lastCompiledSourceRef.current = nextSource;
		},
		[editor]
	);

	// Live recompile on the debounced source.
	useEffect(() => {
		applyCompile(debouncedSource);
	}, [applyCompile, debouncedSource]);

	// Persist every Source edit immediately, ahead of the compile debounce
	// and any file download. This is the single Source of truth: a later
	// visit or a refresh restores the latest edit, including edits that
	// came from a future Open action.
	useEffect(() => {
		storage.save(source);
	}, [source, storage]);

	// Explicit compile on ⌘/Ctrl+Enter. Bypasses the debounce and applies the
	// current source immediately, then suppresses the next debounce-driven
	// effect by recording the source in the ref.
	const handleExplicitCompile = useCallback(() => {
		applyCompile(source);
	}, [applyCompile, source]);
	useCompileShortcut(false, handleExplicitCompile);

	const isTextareaFocused = useCallback(
		() =>
			typeof document !== 'undefined' &&
			document.activeElement?.tagName === 'TEXTAREA',
		[]
	);
	useEditorKeyboardShortcuts(editor, { isTextareaFocused });

	// Selection → Source scroll: when the canvas selection changes, scroll
	// the textarea to the originating line of the first selected node.
	useEffect(() => {
		let previousSelection: readonly string[] = [];
		return editor.subscribe(() => {
			const snapshot = editor.getSnapshot();
			if (snapshot.selection === previousSelection) {
				return;
			}
			previousSelection = snapshot.selection;
			const line = selectionToLine(snapshot.scene, snapshot.selection);
			scrollTextareaToLine(textareaRef.current, line);
		});
	}, [editor]);

	return (
		<main className='h-svh min-h-0 overflow-hidden'>
			<ResizablePanelGroup orientation='horizontal'>
				<ResizablePanel defaultSize='35%' minSize='20%'>
					<div className='flex h-full min-h-0 flex-col'>
						<CodePanel
							onSourceChange={setSource}
							source={source}
							textareaRef={textareaRef}
						/>
						<DiagnosticsList diagnostics={diagnostics} />
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize='65%' minSize='30%'>
					<CanvasHost editor={editor} />
				</ResizablePanel>
			</ResizablePanelGroup>
		</main>
	);
}
