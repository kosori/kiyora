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

/**
 * Whether the run serves the built app or the dev server. A dev server is the
 * right default — it compiles on demand and shows every warning — but any
 * number about how the app performs has to come from the built app, because a
 * dev bundle is several times larger and recompiles as it goes.
 */
export const E2E_SERVER = process.env.E2E_SERVER === 'prod' ? 'prod' : 'dev';

/** The command that serves the app under test. */
export const E2E_SERVER_COMMAND =
  E2E_SERVER === 'prod'
    ? `bunx next start --port ${E2E_PORT}`
    : `bun run dev --port ${E2E_PORT}`;
