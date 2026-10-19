import type { SaveStatus } from '@kiyora/editor';

const LABELS: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
};

/**
 * A minimal, honest read of whether the board is on disk. There is no status bar
 * yet, so this floats in the canvas's corner; a later ticket owns the chrome.
 */
export const SaveIndicator = ({ status }: { status: SaveStatus }) => (
  <p
    aria-live='polite'
    className='absolute right-3 bottom-3 rounded-full border border-border bg-background/90 px-2.5 py-1 text-muted-foreground text-xs shadow-sm backdrop-blur'
    data-state={status}
    data-testid='save-status'
  >
    {LABELS[status]}
  </p>
);
