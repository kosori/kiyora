import { cn } from '@kiyora/ui';
import { Button } from '@kiyora/ui/button';
import { IconX } from '@tabler/icons-react';

export type FileStatusProps = {
	/** Concise error from a file operation. `null` or empty means no error. */
	errorMessage?: string | null;
	/** Clear the current error from view. */
	onDismiss: () => void;
	/** Static shortcut hints to advertise alongside the status. */
	shortcuts?: readonly string[];
};

/**
 * The code-panel footer that shows static keyboard shortcuts and a
 * concise dismissible file-status error.
 *
 * The footer is always quiet when no error is set: only the optional
 * shortcut hints render. When an error is set, the alert region gains
 * an accessible `role="alert"` and a dismiss button so a screen reader
 * announces the failure and a sighted user can clear it. File-operation
 * status never enters the DSL Diagnostic list — it stays here so the
 * user can tell a Kira-language problem from a browser file problem.
 */
export function FileStatus({
	errorMessage,
	onDismiss,
	shortcuts,
}: FileStatusProps) {
	const trimmedError = errorMessage?.trim() ?? '';
	const hasError = trimmedError.length > 0;
	const shortcutsList = shortcuts ?? [];

	// When there is nothing to show (no error and no hints), render
	// nothing — the diagnostics panel below the code panel already
	// occupies the footer slot when diagnostics exist.
	if (!hasError && shortcutsList.length === 0) {
		return null;
	}

	return (
		<footer
			className={cn(
				'flex items-center justify-between gap-3 border-border border-t bg-background px-4 py-2 font-mono text-xs'
			)}
			data-file-status
			data-state={hasError ? 'error' : 'ok'}
			role={hasError ? 'group' : undefined}
		>
			<div className='flex min-w-0 flex-1 items-center gap-3'>
				{hasError ? (
					<span
						className='min-w-0 flex-1 truncate text-destructive'
						data-file-status-error
						role='alert'
					>
						{trimmedError}
					</span>
				) : null}
				{shortcutsList.length > 0 ? (
					<span
						className='flex shrink-0 items-center gap-3 text-muted-foreground'
						data-file-status-shortcuts
					>
						{shortcutsList.map((label) => (
							<span data-file-status-shortcut key={label}>
								{label}
							</span>
						))}
					</span>
				) : null}
			</div>
			{hasError ? (
				<Button
					aria-label='Dismiss file error'
					className='size-6'
					data-file-status-dismiss
					onClick={onDismiss}
					size='icon-sm'
					variant='ghost'
				>
					<IconX aria-hidden='true' />
				</Button>
			) : null}
		</footer>
	);
}
