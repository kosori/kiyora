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

export type FileMenuProps = {
	/** Fired after the user picks Save. The host owns the I/O seam so
	 * the menu only signals intent; the host calls `downloadKira` with
	 * the latest Source and the title derived from it. */
	onSave?: () => void;
	/** Fired after the user picks Open. The host owns the I/O seam so
	 * the menu only signals intent; the host drives `openKira` with the
	 * injected `Openable`. */
	onOpen?: () => void;
	/** Fired after the user picks Export SVG. The host owns the I/O seam
	 * so the menu only signals intent. */
	onExportSvg?: () => void;
	/** Fired after the user picks Export PNG. The host owns the I/O seam
	 * so the menu only signals intent. */
	onExportPng?: () => void;
	/** True once the required font faces are loaded; while false, the
	 * Export SVG and Export PNG items are disabled with an accessible
	 * preparing label. */
	fontsReady: boolean;
};

/**
 * The accessible top-left File dropdown for the canvas surface.
 *
 * Save, Open, Export SVG, and Export PNG are intent-only callbacks: the
 * host owns the I/O seam and the menu never reaches into `downloadKira`,
 * `openKira`, or any browser primitive directly. Export SVG and Export
 * PNG stay disabled until the required font resources have finished
 * loading; the disabled state is communicated with an accessible
 * "preparing fonts" label so a disabled action is not surprising.
 */
export function FileMenu({
	fontsReady,
	onExportPng,
	onExportSvg,
	onOpen,
	onSave,
}: FileMenuProps) {
	const handleSave = useCallback(() => {
		onSave?.();
	}, [onSave]);

	const handleOpen = useCallback(() => {
		onOpen?.();
	}, [onOpen]);

	const handleExportSvg = useCallback(() => {
		if (!fontsReady) {
			return;
		}
		onExportSvg?.();
	}, [fontsReady, onExportSvg]);

	const handleExportPng = useCallback(() => {
		if (!fontsReady) {
			return;
		}
		onExportPng?.();
	}, [fontsReady, onExportPng]);

	const preparingLabel = fontsReady ? undefined : 'Preparing fonts…';

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
					<DropdownMenuShortcut>⌘/Ctrl+S</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem data-file-action='open' onClick={handleOpen}>
					<span>Open</span>
					<DropdownMenuShortcut>⌘/Ctrl+O</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					aria-disabled={!fontsReady}
					data-file-action='export-svg'
					disabled={!fontsReady}
					onClick={handleExportSvg}
					title={preparingLabel}
				>
					<span>{fontsReady ? 'Export SVG' : 'Preparing fonts…'}</span>
				</DropdownMenuItem>
				<DropdownMenuItem
					aria-disabled={!fontsReady}
					data-file-action='export-png'
					disabled={!fontsReady}
					onClick={handleExportPng}
					title={preparingLabel}
				>
					<span>{fontsReady ? 'Export PNG' : 'Preparing fonts…'}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
