/**
 * The key one panel's crash request is written to. A browser test sets it
 * before the app boots; it names the panel so only that one fails.
 */
export const crashPanelKey = (name: string): string =>
  `kiyora:test:crash-panel:${name}`;

/**
 * A test seam: a key a browser test can set before the app boots to make one
 * panel fail on purpose, so the error boundary can be proven to leave the board
 * intact. It is read, never written, by the app, and it fails only the panel it
 * names. The same localStorage channel the storage faults use.
 *
 * The seam is gated on `NEXT_PUBLIC_E2E`, which a normal build folds to false:
 * a shipped app ignores the key even when someone writes it, so a user cannot
 * drive production behaviour from localStorage. The end-to-end harness sets the
 * flag to `1` for the server it starts.
 */
export const shouldCrashPanel = (name: string): boolean => {
  if (process.env.NEXT_PUBLIC_E2E !== '1') {
    return false;
  }
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(crashPanelKey(name)) === '1';
  } catch {
    // Fail safe: unreadable storage means "do not crash", never a fault thrown
    // from the middle of panel rendering.
    return false;
  }
};
