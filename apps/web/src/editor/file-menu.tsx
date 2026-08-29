import { Button } from '@kiyora/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from '@kiyora/ui/dropdown-menu';
import { IconChevronDown, IconFile } from '@tabler/icons-react';
import { useCallback } from 'react';
import {
	type Downloadable,
	downloadKira,
	type Openable,
	openKira,
} from './io/io';

export type FileMenuProps = {
	/** Where Save Blob lands. Injected so tests can observe the download. */
	downloadable: Downloadable;
	/** True once the required font faces are loaded; while false, the
	 * Export SVG item is disabled with an accessible preparing label. */
	fontsReady: boolean;
	/** Where the Open file picker is sourced from. Injected so tests can
	 * observe the picker without opening a real file dialog. */
	openable: Openable;
	/** Fired after a successful Export SVG. The host owns the I/O seam
	 * so the menu only signals intent. */
	onExportSvg?: () => void;
	/** Optional notification fired after a successful Open. */
	onOpen?: (source: string) => void;
	/** Optional notification fired after a file-operation failure. */
	onOpenError?: (message: string) => void;
	/** Optional notification fired after a successful Save. */
	onSave?: (source: string) => void;
	/** The current Kiyora Source. Read at click time so the latest edit is saved. */
	source: string;
	/** The current Diagram title. Empty string becomes `diagram.kira` downstream. */
	title: string;
};

/**
 * The accessible top-left File dropdown for the canvas surface.
 *
 * Save downloads the current Source as a Kira file. Open replaces the
 * current Source with the text read from a chosen Kira file via the
 * injected `Openable`. Export SVG hands the host's current Scene to the
 * I/O boundary and is disabled until the required font resources have
 * finished loading; the disabled state is communicated with an
 * accessible "preparing fonts" label so a disabled action is not
 * surprising.
 *
 * Export PNG remains reserved for a later increment.
 */
export function FileMenu({
	downloadable,
	fontsReady,
	onExportSvg,
	onOpen,
	onOpenError,
	onSave,
	openable,
	source,
	title,
}: FileMenuProps) {
	const handleSave = useCallback(() => {
		downloadKira({ downloadable, source, title });
		onSave?.(source);
	}, [downloadable, onSave, source, title]);

	const handleOpen = useCallback(() => {
		openKira({
			onError: (message) => onOpenError?.(message),
			onSource: (next) => onOpen?.(next),
			openable,
		});
	}, [onOpen, onOpenError, openable]);

	const handleExportSvg = useCallback(() => {
		if (!fontsReady) {
			return;
		}
		onExportSvg?.();
	}, [fontsReady, onExportSvg]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label='File menu'
				data-file-menu-trigger='true'
				render={
					<Button size='sm' variant='outline'>
						<IconFile aria-hidden='true' />
						<span>File</span>
						<IconChevronDown aria-hidden='true' />
					</Button>
				}
			/>
			<DropdownMenuContent align='start' sideOffset={6}>
				<DropdownMenuItem data-file-action='save' onClick={handleSave}>
					<span>Save</span>
					<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem data-file-action='open' onClick={handleOpen}>
					<span>Open</span>
					<DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					aria-disabled={!fontsReady}
					data-file-action='export-svg'
					disabled={!fontsReady}
					onClick={handleExportSvg}
					title={fontsReady ? undefined : 'Preparing fonts…'}
				>
					<span>{fontsReady ? 'Export SVG' : 'Preparing fonts…'}</span>
				</DropdownMenuItem>
				<ReservedFileMenuItem label='Export PNG' reservedFor='export-png' />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

type ReservedFileMenuItemProps = {
	label: string;
	reservedFor: 'export-png';
	shortcut?: string;
};

/**
 * A disabled menu item that names a future File action. Reserving the
 * slot now keeps the control's shape stable across increments: each
 * later issue (Export PNG) replaces one of these placeholders with a
 * live item without changing the menu's structure.
 */
function ReservedFileMenuItem({
	label,
	reservedFor,
	shortcut,
}: ReservedFileMenuItemProps) {
	return (
		<DropdownMenuItem
			aria-disabled='true'
			data-file-action={reservedFor}
			disabled
		>
			<span>{label}</span>
			{shortcut ? (
				<DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
			) : null}
		</DropdownMenuItem>
	);
}
