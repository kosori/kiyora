import type { StorageFault } from '@kiyora/model';

type Props = {
  fault: StorageFault | null;
};

/**
 * The line a page shows when the account lookup failed. It floats above the
 * library or the editor, so the board stays usable while the person learns that
 * the account state could not be checked.
 */
export const SessionFault = ({ fault }: Props) =>
  fault === null ? null : (
    <p
      className='fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-background px-3 py-2 text-destructive text-sm shadow-sm'
      data-testid='session-fault'
      role='alert'
    >
      Your account could not be checked just now. Your boards still work —
      reload to try again.
    </p>
  );
