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

/**
 * Whether the run includes the `server` project. It is opt-in so a contributor
 * without Postgres can still run every browser spec.
 */
export const E2E_SERVER_DB = process.env.E2E_SERVER_DB === '1';

const serve = (): string =>
  E2E_SERVER === 'prod'
    ? `bunx next start --port ${E2E_PORT}`
    : `bun run dev --port ${E2E_PORT}`;

/** The command that serves the app under test. */
export const E2E_SERVER_COMMAND = E2E_SERVER_DB
  ? `bun run db:migrate && ${serve()}`
  : serve();

/** The Postgres the server project owns. Defaults to the documented local one. */
export const E2E_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://kiyora:kiyora@localhost:5432/kiyora';

/**
 * The account configuration the server project starts with. The OAuth pairs are
 * placeholders: CI never walks a provider's callback, and the dev-credentials
 * provider is the seam it does walk.
 */
export const E2E_AUTH_ENV: Record<string, string> = E2E_SERVER_DB
  ? {
      AUTH_DEV_CREDENTIALS: '1',
      BETTER_AUTH_SECRET: 'kiyora-e2e-secret-not-for-production',
      BETTER_AUTH_URL: E2E_BASE_URL,
      DATABASE_URL: E2E_DATABASE_URL,
      GITHUB_CLIENT_ID: 'kiyora-e2e-github-client',
      GITHUB_CLIENT_SECRET: 'kiyora-e2e-github-secret',
      GOOGLE_CLIENT_ID: 'kiyora-e2e-google-client',
      GOOGLE_CLIENT_SECRET: 'kiyora-e2e-google-secret',
    }
  : {};
