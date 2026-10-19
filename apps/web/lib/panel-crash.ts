/**
 * A test seam: a key a browser test can set before the app boots to make one
 * panel fail on purpose, so the error boundary can be proven to leave the board
 * intact. It is read, never written, by the app, and it fails only the panel it
 * names. The same localStorage channel the storage faults use.
 */
export const shouldCrashPanel = (name: string): boolean => {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(`kiyora:test:crash-panel:${name}`) === '1';
  } catch {
    return false;
  }
};
