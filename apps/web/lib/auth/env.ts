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

const REQUIRED = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
] as const;

type RequiredVariable = (typeof REQUIRED)[number];

const readValue = (
  source: NodeJS.ProcessEnv,
  name: RequiredVariable
): string | null => {
  const value = source[name]?.trim();
  return value === undefined || value === '' ? null : value;
};

const originOf = (baseUrl: string): string => {
  try {
    return new URL(baseUrl).origin;
  } catch (error) {
    throw new AuthConfigurationError(
      `BETTER_AUTH_URL must be an absolute URL, received "${baseUrl}".`,
      { cause: error }
    );
  }
};

/**
 * Reads and validates the account configuration. Returns null when no account
 * variable is present, so a deployment without accounts keeps serving the
 * library. Once any account variable is set, every required one must be present:
 * a half-configured server fails at boot and names what is missing.
 */
export const readAuthEnv = (
  source: NodeJS.ProcessEnv = process.env
): AuthEnv | null => {
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

  const baseUrl = readValue(source, 'BETTER_AUTH_URL') ?? '';

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    databaseUrl: readValue(source, 'DATABASE_URL') ?? '',
    devCredentials: devFlag,
    github: {
      clientId: readValue(source, 'GITHUB_CLIENT_ID') ?? '',
      clientSecret: readValue(source, 'GITHUB_CLIENT_SECRET') ?? '',
    },
    google: {
      clientId: readValue(source, 'GOOGLE_CLIENT_ID') ?? '',
      clientSecret: readValue(source, 'GOOGLE_CLIENT_SECRET') ?? '',
    },
    secret: readValue(source, 'BETTER_AUTH_SECRET') ?? '',
    trustedOrigins: [
      originOf(baseUrl),
      'http://localhost:*',
      'http://127.0.0.1:*',
    ],
  };
};
