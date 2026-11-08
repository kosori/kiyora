'use client';

import { useCopyPng } from './copy-png-context';

/**
 * The last clipboard refusal or fallback notice, shown in the chrome rather
 * than inside the board menu, so a copy asked for from the selection menu is
 * never answered on a surface that is closed.
 */
export const CopyStatus = () => {
  const { error, notice } = useCopyPng();

  if (error === null && notice === null) {
    return null;
  }

  return (
    <p
      className={
        error === null
          ? 'pointer-events-none absolute top-16 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--chrome-surface)] px-3 py-1 text-muted-foreground text-xs shadow-[0_0_0_1px_var(--chrome-ring)]'
          : 'pointer-events-none absolute top-16 left-1/2 z-40 -translate-x-1/2 rounded-full bg-destructive/10 px-3 py-1 text-destructive text-xs shadow-[0_0_0_1px_var(--chrome-ring)]'
      }
      data-testid={error === null ? 'import-notice' : 'file-error'}
      role={error === null ? 'status' : 'alert'}
    >
      {error ?? notice}
    </p>
  );
};
