/** The account configuration a server needs before it may accept a session. */
export type AuthEnv = {
  databaseUrl: string;
  secret: string;
  baseUrl: string;
  google: { clientId: string; clientSecret: string };
  github: { clientId: string; clientSecret: string };
  devCredentials: boolean;
  trustedOrigins: string[];
};

/** A configuration error raised before the server can accept a request. */
export class AuthConfigurationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AuthConfigurationError';
  }
}

/**
 * Every variable an account-enabled server must set. Exported so boot guidance
 * lists the real contract instead of a hand-written subset that can drift.
 */
export const REQUIRED = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
] as const;

type RequiredVariable = (typeof REQUIRED)[number];

const DEV_ENVIRONMENTS = new Set(['development', 'test']);

const PLACEHOLDER_SECRETS = new Set([
  'changeme',
  'change-me',
  'change_me',
  'default',
  'example',
  'password',
  'placeholder',
  'secret',
  'test',
  'testing',
  'your-secret-here',
]);

const PRODUCTION_ORIGIN = 'https://kiyora.ccdx.dev';

const readValue = (
  source: NodeJS.ProcessEnv,
  name: RequiredVariable
): string | null => {
  const value = source[name]?.trim();
  return value === undefined || value === '' ? null : value;
};

const requiredValue = (
  source: NodeJS.ProcessEnv,
  name: RequiredVariable
): string => {
  const value = readValue(source, name);

  if (value === null) {
    throw new AuthConfigurationError(
      `Accounts are configured but missing ${name}.`
    );
  }

  return value;
};

/** Parses an absolute http(s) URL; a non-web protocol is refused by name. */
const absoluteUrlOf = (name: string, value: string): URL => {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new AuthConfigurationError(
      `${name} must be an absolute URL, received "${value}".`,
      { cause: error }
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AuthConfigurationError(
      `${name} must use http or https, received "${url.protocol}".`
    );
  }

  return url;
};

/** Reads a session-signing key, refusing a placeholder or a short value. */
const secretOf = (source: NodeJS.ProcessEnv): string => {
  const secret = requiredValue(source, 'BETTER_AUTH_SECRET');

  if (secret.length < 32 || PLACEHOLDER_SECRETS.has(secret.toLowerCase())) {
    throw new AuthConfigurationError(
      'BETTER_AUTH_SECRET must be at least 32 characters and not a placeholder; generate one with "openssl rand -base64 32".'
    );
  }

  return secret;
};

/**
 * The origins Better Auth trusts. The deployed host is a documented default;
 * localhost entries exist only outside production, and extra hosts arrive
 * through `AUTH_TRUSTED_ORIGINS` one http(s) origin each.
 */
const trustedOriginsOf = (
  source: NodeJS.ProcessEnv,
  baseUrl: string
): string[] => {
  const origins = [
    absoluteUrlOf('BETTER_AUTH_URL', baseUrl).origin,
    PRODUCTION_ORIGIN,
  ];

  if (source.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:*',
      'http://127.0.0.1:*',
      'https://kiyora.localhost',
      'https://*.localhost:*'
    );
  }

  for (const entry of source.AUTH_TRUSTED_ORIGINS?.split(',') ?? []) {
    const origin = entry.trim();

    if (origin !== '') {
      origins.push(absoluteUrlOf('AUTH_TRUSTED_ORIGINS', origin).origin);
    }
  }

  return [...new Set(origins)];
};

/**
 * Reads and validates the account configuration. Returns null when no account
 * variable is present, so a deployment without accounts keeps serving the
 * library. Once any account variable is set, every required one must be present:
 * a half-configured server fails at boot and names what is missing.
 *
 * Development credentials are allowed only when `NODE_ENV` is exactly
 * `development` or `test`; an unset or unrecognised environment is refused, so
 * a hand-rolled container start cannot open the password routes.
 */
export const readAuthEnv = (
  source: NodeJS.ProcessEnv = process.env
): AuthEnv | null => {
  const appUrl = source.NEXT_PUBLIC_APP_URL?.trim();

  if (appUrl !== undefined && appUrl !== '') {
    absoluteUrlOf('NEXT_PUBLIC_APP_URL', appUrl);
  }

  const devFlag = source.AUTH_DEV_CREDENTIALS === '1';
  const configured =
    devFlag || REQUIRED.some((name) => readValue(source, name) !== null);

  if (!configured) {
    return null;
  }

  const missing = REQUIRED.filter((name) => readValue(source, name) === null);

  if (missing.length > 0) {
    throw new AuthConfigurationError(
      `Accounts are configured but missing ${missing.join(', ')}.`
    );
  }

  if (devFlag && source.NODE_ENV === 'production') {
    throw new AuthConfigurationError(
      'AUTH_DEV_CREDENTIALS must not be set in production.'
    );
  }

  if (devFlag && !DEV_ENVIRONMENTS.has(source.NODE_ENV ?? '')) {
    throw new AuthConfigurationError(
      `AUTH_DEV_CREDENTIALS is only allowed when NODE_ENV is "development" or "test"; received "${source.NODE_ENV ?? 'unset'}".`
    );
  }

  const baseUrl = requiredValue(source, 'BETTER_AUTH_URL').replace(/\/+$/, '');

  return {
    baseUrl,
    databaseUrl: requiredValue(source, 'DATABASE_URL'),
    devCredentials: devFlag,
    github: {
      clientId: requiredValue(source, 'GITHUB_CLIENT_ID'),
      clientSecret: requiredValue(source, 'GITHUB_CLIENT_SECRET'),
    },
    google: {
      clientId: requiredValue(source, 'GOOGLE_CLIENT_ID'),
      clientSecret: requiredValue(source, 'GOOGLE_CLIENT_SECRET'),
    },
    secret: secretOf(source),
    trustedOrigins: trustedOriginsOf(source, baseUrl),
  };
};
