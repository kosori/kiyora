import type { StorageFault } from '@kiyora/editor';
import { cn } from 'cn';
import type { StorageHealth } from './use-autosave';

const STATUS_LABELS: Record<StorageHealth['status'], string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
};

/** What to do next, per fault. Each one names the thing the person can act on. */
const FAULT_MESSAGES: Record<StorageFault['kind'], string> = {
  blocked: 'Storage is blocked — allow site data to keep saving',
  corrupt:
    'The saved board was unreadable — it is set aside and a fresh board opened',
  images:
    'Images need IndexedDB — local storage cannot hold them, so this board is not saved',
  quota: 'Storage is full — free some space to keep saving',
  unavailable: 'Storage is unavailable — this board will not be saved',
};

const messageFor = ({
  fault,
  migratedFrom,
  secondary,
  status,
}: StorageHealth): string => {
  if (secondary) {
    return 'Open in another tab — editing here will not be saved';
  }
  if (fault !== null) {
    return FAULT_MESSAGES[fault.kind];
  }
  if (migratedFrom !== null) {
    return 'Board updated to this version — a recovery copy was kept';
  }
  return STATUS_LABELS[status];
};

/**
 * The honest read of where the board is: saved, still saving, or held back by a
 * fault or another tab. A problem takes the message over the plain status, so a
 * failure is never hidden behind a green "Saved". The `data-state` stays the
 * write status, so a test can watch it move.
 */
export const SaveIndicator = (health: StorageHealth) => {
  const { fault, migratedFrom, secondary, status } = health;

  return (
    <p
      aria-live='polite'
      className={cn(
        'absolute right-3 bottom-3 rounded-full border px-2.5 py-1 text-xs shadow-sm backdrop-blur',
        fault === null && !secondary
          ? 'border-border bg-background/90 text-muted-foreground'
          : 'border-destructive/40 bg-destructive/10 text-destructive'
      )}
      data-fault={fault?.kind}
      data-migrated={migratedFrom === null ? undefined : migratedFrom}
      data-secondary={secondary ? 'true' : undefined}
      data-state={status}
      data-testid='save-status'
    >
      {messageFor(health)}
    </p>
  );
};
