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
import { type Downloadable, downloadKira } from './io/io';

export type FileMenuProps = {
	/** Optional notification fired after a successful Save. */
	onSave?: (source: string) => void;
	/** The current Kiyora Source. Read at click time so the latest edit is saved. */
	source: string;
	/** The current Diagram title. Empty string becomes `diagram.kira` downstream. */
	title: string;
	/** Where the Save Blob lands. Injected so tests can observe the download. */
	downloadable: Downloadable;
};

/**
 * The accessible top-left File dropdown for the canvas surface.
 *
 * Issue 02 only ships Save: Open and the two visual exports (SVG, PNG)
 * are reserved placeholders that exist as disabled items in the menu so
 * later increments can fill them in without re-shaping the control.
 */
export function FileMenu({
	onSave,
	source,
	title,
	downloadable,
}: FileMenuProps) {
	const handleSave = useCallback(() => {
		downloadKira({ downloadable, source, title });
		onSave?.(source);
	}, [downloadable, onSave, source, title]);

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
				<ReservedFileMenuItem label='Open' reservedFor='open' shortcut='⌘O' />
				<ReservedFileMenuItem label='Export SVG' reservedFor='export-svg' />
				<ReservedFileMenuItem label='Export PNG' reservedFor='export-png' />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

type ReservedFileMenuItemProps = {
	label: string;
	reservedFor: 'export-png' | 'export-svg' | 'open';
	shortcut?: string;
};

/**
 * A disabled menu item that names a future File action. Reserving the
 * slot now keeps the control's shape stable across increments: each
 * later issue (Open, Export SVG, Export PNG) replaces one of these
 * placeholders with a live item without changing the menu's structure.
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
