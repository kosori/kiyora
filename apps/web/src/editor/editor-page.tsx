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
import { FileStatus } from './file-status';
import {
	browserDownloadable,
	browserOpenable,
	type Downloadable,
	downloadKira,
	type Openable,
	openKira,
} from './io/io';
import { parseAndCompile } from './parse-and-compile';
import { scrollTextareaToLine } from './scroll-textarea-to-line';
import { selectionToLine } from './selection-to-line';
import { browserSourceStorage, type SourceStorage } from './source-storage';
import { STARTER_SOURCE } from './starter';
import { useCompileShortcut } from './use-compile-shortcut';
import { useDebouncedValue } from './use-debounced-value';
import { useEditorKeyboardShortcuts } from './use-editor-keyboard-shortcuts';
import { useFileShortcut } from './use-file-shortcut';

const COMPILE_DEBOUNCE_MS = 250;

/** Static shortcut hints shown in the code-panel footer. */
const FILE_SHORTCUTS = ['⌘S Save', '⌘O Open'] as const;

/**
 * The split-pane Source editor and interactive canvas surface.
 *
 * Source is the textual interchange format and the only thing this page
 * persists. Canvas-only Scene placement, selection, and the Viewport are
 * transient: a fresh compile from the restored Source produces a new
 * Scene, and the canvas host's one-shot fit-to-view frames it on mount.
 */
export function EditorPage() {
	return (
		<EditorPageSurface
			downloadable={useMemo(browserDownloadable, [])}
			openable={useMemo(browserOpenable, [])}
			storage={useMemo(browserSourceStorage, [])}
		/>
	);
}

export type EditorPageSurfaceProps = {
	/** Where the Save Blob lands. Injected so tests can observe the download. */
	downloadable: Downloadable;
	/** Where the Open file picker is sourced from. Injected so tests can
	 * observe the picker without opening a real browser dialog. */
	openable: Openable;
	storage: SourceStorage;
};

/**
 * The testable surface behind `EditorPage`. Accepts an injected Source
 * storage so the editor-page tests can replace the browser boundary with
 * a controlled fake and observe initial fallback, restore, and immediate
 * persistence without touching `localStorage`. The injected `Downloadable`
 * is the only path that can hand a Blob to a real browser download, and
 * the injected `Openable` is the only path that can prompt the user for
 * a Kira file.
 */
export function EditorPageSurface({
	downloadable,
	openable,
	storage,
}: EditorPageSurfaceProps) {
	const initialSource = storage.load() ?? STARTER_SOURCE;
	const [source, setSource] = useState(initialSource);
	const [editor] = useState<Editor>(() =>
		createEditor(parseAndCompile(initialSource).scene)
	);
	const [fileError, setFileError] = useState<string | null>(null);
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

	// The Diagram title for the current Source. Computed from the live
	// (non-debounced) Source so a Save click uses the title the user is
	// looking at, not a stale value from the last debounce.
	const currentTitle = useMemo(
		() => parseAndCompile(source).scene.title,
		[source]
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

	// Save: download the current Source. Read at click time so the latest
	// edit is what leaves the browser.
	const handleSave = useCallback(() => {
		downloadKira({ downloadable, source, title: currentTitle });
	}, [downloadable, source, currentTitle]);

	// Open: ask the injected Openable for a Kira file. The page replaces
	// Source when readKiraText resolves and immediately compiles a new
	// Scene — Open is a structural replacement, not a text edit, so it
	// must not wait for the live-compile debounce. An admission failure
	// surfaces as a footer error and leaves Source and Scene untouched.
	const handleOpen = useCallback(
		(nextSource: string) => {
			setSource(nextSource);
			applyCompile(nextSource);
			setFileError(null);
		},
		[applyCompile]
	);
	const handleOpenError = useCallback((message: string) => {
		setFileError(message);
	}, []);
	const handleDismissFileError = useCallback(() => {
		setFileError(null);
	}, []);

	useFileShortcut({
		isTextareaFocused,
		onOpen: () => {
			openKira({
				onError: handleOpenError,
				onSource: handleOpen,
				openable,
			});
		},
		onSave: handleSave,
	});

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
						<FileStatus
							errorMessage={fileError}
							onDismiss={handleDismissFileError}
							shortcuts={FILE_SHORTCUTS}
						/>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize='65%' minSize='30%'>
					<CanvasHost
						downloadable={downloadable}
						editor={editor}
						onOpen={handleOpen}
						onOpenError={handleOpenError}
						onSave={handleSave}
						openable={openable}
						source={source}
						title={currentTitle}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>
		</main>
	);
}
