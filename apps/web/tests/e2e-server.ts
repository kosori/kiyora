const DEFAULT_PORT = 4319;

const configured = Number(process.env.E2E_PORT);

/**
 * The port the end-to-end run owns. Overridable so that parallel checkouts —
 * worktrees, or two agents on one machine — do not fight over a single port.
 * The default is the one CI and a lone checkout use.
 */
export const E2E_PORT =
  Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_PORT;

/** Where the end-to-end run expects the application it is testing. */
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
