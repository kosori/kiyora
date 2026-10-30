import { readAuthEnv } from './lib/auth/env';

/**
 * Validates the account configuration before the server is ready to answer. A
 * half-configured deployment fails here, naming the variable, rather than on
 * the first sign-in request.
 */
export const register = async (): Promise<void> => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const config = readAuthEnv();

  if (config === null) {
    return;
  }

  const { assertMigrationsApplied } = await import('./lib/db/migrate-check');

  await assertMigrationsApplied(config.databaseUrl);
};
