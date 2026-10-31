import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { getDatabase } from '../db';
import { schema } from '../db/schema';
import { AuthConfigurationError, type AuthEnv, readAuthEnv } from './env';

const buildAuth = (config: AuthEnv) =>
  betterAuth({
    baseURL: config.baseUrl,
    database: drizzleAdapter(getDatabase(config.databaseUrl).db, {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: { enabled: config.devCredentials },
    plugins: [nextCookies()],
    secret: config.secret,
    socialProviders: {
      github: {
        clientId: config.github.clientId,
        clientSecret: config.github.clientSecret,
      },
      google: {
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
      },
    },
    trustedOrigins: config.trustedOrigins,
  });

type Auth = ReturnType<typeof buildAuth>;

const holder = globalThis as typeof globalThis & {
  __kiyoraAuth?: Auth;
};

/**
 * The Better Auth instance for this process. Built on first use so importing a
 * route never requires a database; a missing configuration surfaces as an
 * `AuthConfigurationError` naming the variable, not as a stack trace.
 */
export const getAuth = (): Auth => {
  const existing = holder.__kiyoraAuth;

  if (existing) {
    return existing;
  }

  const config = readAuthEnv();

  if (config === null) {
    throw new AuthConfigurationError(
      'Accounts are not configured. Set DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL to enable them.'
    );
  }

  const auth = buildAuth(config);

  holder.__kiyoraAuth = auth;

  return auth;
};
