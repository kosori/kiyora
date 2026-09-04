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
import { errorMessageOf } from './error-message';
import { FileStatus } from './file-status';
import {
	browserDownloadable,
	browserFontReadiness,
	browserOpenable,
	browserPngRasterizer,
	type Downloadable,
	downloadKira,
	downloadPng,
	downloadSvg,
	type FontReadiness,
	type Openable,
	openKira,
	type PngRasterizer,
} from './io/io';
import { parseAndCompile, parseTitle } from './parse-and-compile';
import { scrollTextareaToLine } from './scroll-textarea-to-line';
import { selectionToLine } from './selection-to-line';
import { browserSourceStorage, type SourceStorage } from './source-storage';
import { STARTER_SOURCE } from './starter';
import { useCanvasKeyboardShortcuts } from './use-canvas-keyboard-shortcuts';
import { useCompileShortcut } from './use-compile-shortcut';
import { useDebouncedValue } from './use-debounced-value';
import { useEditorKeyboardShortcuts } from './use-editor-keyboard-shortcuts';
import { useFileShortcut } from './use-file-shortcut';
import { useFontReadiness } from './use-font-readiness';

const COMPILE_DEBOUNCE_MS = 250;

/** Static shortcut hints shown in the code-panel footer. Both ⌘ (macOS)
 * and Ctrl are listed so non-macOS users see the modifier the spec
 * pairs in `⌘/Ctrl+S` and `⌘/Ctrl+O`. */
const FILE_SHORTCUTS = ['⌘/Ctrl+S', '⌘/Ctrl+O'] as const;

/**
 * The split-pane Source editor and interactive canvas surface.
 *
 * Source is the textual interchange format and the only thing this page
 * persists. Canvas-only Scene placement, selection, and the Viewport are
 * transient: a fresh compile from the restored Source produces a new
 * Scene, and the canvas host fits it — once on mount, and once again when
 * a persisted Source replaces the starter after hydration.
 *
 * The first render — server and client — always shows the starter Source.
 * Persisted Source lives only in the browser, so restoring it in an
 * effect keeps SSR markup and hydration in lockstep instead of reading
 * localStorage during render.
 */
export function EditorPage() {
	return (
		<EditorPageSurface
			downloadable={useMemo(browserDownloadable, [])}
			fontReadiness={useMemo(browserFontReadiness, [])}
			openable={useMemo(browserOpenable, [])}
			rasterizer={useMemo(browserPngRasterizer, [])}
			storage={useMemo(browserSourceStorage, [])}
		/>
	);
}

export type EditorPageSurfaceProps = {
	/** Where the Save Blob lands. Injected so tests can observe the download. */
	downloadable: Downloadable;
	/** A font-readiness observable whose `ready` Promise resolves once
	 * the SVG export has the bytes it needs to embed the Kiyora family. */
	fontReadiness: FontReadiness;
	/** Where the Open file picker is sourced from. Injected so tests can
	 * observe the picker without opening a real browser dialog. */
	openable: Openable;
	/** Browser-side SVG-to-PNG rasterizer. Injected so tests can observe
	 * the call and so the editor page never touches `Image`/`Canvas`
	 * directly. */
	rasterizer: PngRasterizer;
	storage: SourceStorage;
};

/**
 * The testable surface behind `EditorPage`. Accepts an injected Source
 * storage so the editor-page tests can replace the browser boundary with
 * a controlled fake and observe initial fallback, restore, and immediate
 * persistence without touching `localStorage`. The injected `Downloadable`
 * is the only path that can hand a Blob to a real browser download, the
 * injected `Openable` is the only path that can prompt the user for a
 * Kira file, and the injected `PngRasterizer` is the only path that can
 * rasterize an SVG to a PNG Blob. The injected `FontReadiness` controls
 * when the Export SVG and Export PNG menu items become available.
 */
export function EditorPageSurface({
	downloadable,
	fontReadiness,
	openable,
	rasterizer,
	storage,
}: EditorPageSurfaceProps) {
	const [source, setSource] = useState(STARTER_SOURCE);
	const [editor] = useState<Editor>(() =>
		createEditor(parseAndCompile(STARTER_SOURCE).scene)
	);
	const [fileError, setFileError] = useState<string | null>(null);
	const [fitSignal, setFitSignal] = useState(0);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	// The source string the editor was last applied with. Used to skip the
	// compile effect when neither the debounced value nor the immediate
	// compile produced a new scene.
	const lastCompiledSourceRef = useRef<string>(STARTER_SOURCE);
	// True once the mount-time restore attempt has settled. Source
	// persistence is suppressed until then so the transient starter
	// Source can never overwrite a saved workspace.
	const [restored, setRestored] = useState(false);
	const debouncedSource = useDebouncedValue(source, COMPILE_DEBOUNCE_MS);

	// Parse the debounced Source once; the diagnostics list and the applied
	// Scene both derive from this single parse.
	const debouncedResult = useMemo(
		() => parseAndCompile(debouncedSource),
		[debouncedSource]
	);
	const { diagnostics } = debouncedResult;

	// The Diagram title for the current Source. Computed from the live
	// (non-debounced) Source so a Save click uses the title the user is
	// looking at, not a stale value from the last debounce. Parse-only:
	// the title never needs a Compile.
	const currentTitle = useMemo(() => parseTitle(source), [source]);

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

	// Live recompile on the debounced Source. The Scene comes from the shared
	// debounced parse, so no re-parse happens here; the ref guard still
	// suppresses the apply when an explicit compile already applied this
	// same Source.
	useEffect(() => {
		if (debouncedSource === lastCompiledSourceRef.current) {
			return;
		}
		editor.setScene(debouncedResult.scene);
		lastCompiledSourceRef.current = debouncedSource;
	}, [debouncedResult, debouncedSource, editor]);

	// Subscribe to the injected font readiness observable. The Export
	// SVG item stays disabled until the promise resolves and exposes
	// the bytes the boundary embeds. A rejection re-enables the action
	// and surfaces a failure message that the editor routes through
	// the file-status footer.
	const {
		failure: fontFailure,
		fonts: exportFonts,
		ready: fontsReady,
	} = useFontReadiness(fontReadiness);

	// Restore the persisted Source once the first client render has
	// committed. The server and the initial client render always show
	// the starter Source so hydration matches; the saved workspace then
	// replaces it before the persistence effect is allowed to write,
	// guaranteeing the starter can never clobber a saved Source.
	useEffect(() => {
		let stored: string | null;
		try {
			stored = storage.load();
		} catch {
			stored = null;
		}
		if (stored !== null && stored !== STARTER_SOURCE) {
			const compiled = parseAndCompile(stored);
			setSource(stored);
			editor.setScene(compiled.scene);
			lastCompiledSourceRef.current = stored;
			const hasError = compiled.diagnostics.some(
				(diagnostic) => diagnostic.severity === 'error'
			);
			if (!hasError) {
				setFitSignal((signal) => signal + 1);
			}
		}
		setRestored(true);
	}, [storage, editor]);

	// Persist every Source edit immediately, ahead of the compile debounce
	// and any file download. This is the single Source of truth: a later
	// visit or a refresh restores the latest edit, including edits that
	// came from a future Open action. The effect stays closed until the
	// restore attempt has settled.
	useEffect(() => {
		if (!restored) {
			return;
		}
		storage.save(source);
	}, [source, storage, restored]);

	// Explicit compile on ⌘/Ctrl+Enter. Bypasses the debounce and applies the
	// current source immediately, then suppresses the next debounce-driven
	// effect by recording the source in the ref.
	const handleExplicitCompile = useCallback(() => {
		applyCompile(source);
	}, [applyCompile, source]);
	useCompileShortcut(false, handleExplicitCompile);

	useEditorKeyboardShortcuts(editor);
	useCanvasKeyboardShortcuts(editor);

	// Save: download the current Source. Read at click time so the latest
	// edit is what leaves the browser.
	const handleSave = useCallback(() => {
		downloadKira({ downloadable, source, title: currentTitle });
	}, [downloadable, source, currentTitle]);

	// Export SVG: flush the latest Source through the parse-and-compile
	// boundary before snapshotting, then project the current Scene
	// (including canvas-only placement edits when Source has not
	// changed). The handler is a no-op while fonts are preparing; the
	// menu disables the action and an accessible label explains why.
	// When the font readiness rejected, the action is re-enabled and
	// a click surfaces the rejection message through the file-status
	// footer instead of silently failing.
	const handleExportSvg = useCallback(() => {
		if (!exportFonts) {
			if (fontFailure) {
				setFileError(fontFailure);
			}
			return;
		}
		applyCompile(source);
		downloadSvg({
			downloadable,
			fonts: exportFonts,
			scene: editor.getScene(),
			title: currentTitle,
		});
	}, [
		applyCompile,
		currentTitle,
		downloadable,
		editor,
		exportFonts,
		fontFailure,
		source,
	]);

	// Export PNG: same flush-and-snapshot policy as Export SVG, then
	// rasterize the portable SVG to a transparent PNG via the injected
	// rasterizer. The I/O boundary owns the size check so an
	// over-budget diagram fails fast with an actionable error pointing
	// the user to SVG; rasterizer or encoding failures propagate as a
	// file-status message so the workspace is preserved.
	const handleExportPng = useCallback(() => {
		if (!exportFonts) {
			if (fontFailure) {
				setFileError(fontFailure);
			}
			return;
		}
		applyCompile(source);
		downloadPng({
			downloadable,
			fonts: exportFonts,
			rasterizer,
			scene: editor.getScene(),
			title: currentTitle,
		}).catch((cause: unknown) => {
			setFileError(
				errorMessageOf(cause, 'Failed to export the diagram as PNG.')
			);
		});
	}, [
		applyCompile,
		currentTitle,
		downloadable,
		editor,
		exportFonts,
		fontFailure,
		rasterizer,
		source,
	]);

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

	// Drive `openKira` from the same path the File menu and the keyboard
	// shortcut share, so a single Open click resolves exactly one picker
	// and replaces Source once.
	const handleOpenKira = useCallback(() => {
		openKira({
			onError: handleOpenError,
			onSource: handleOpen,
			openable,
		});
	}, [handleOpen, handleOpenError, openable]);

	useFileShortcut({ onOpen: handleOpenKira, onSave: handleSave });

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
						editor={editor}
						fitSignal={fitSignal}
						fontsReady={fontsReady}
						onExportPng={handleExportPng}
						onExportSvg={handleExportSvg}
						onOpen={handleOpenKira}
						onSave={handleSave}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>
		</main>
	);
}
