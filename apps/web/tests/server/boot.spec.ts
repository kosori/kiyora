import { expect, test } from '@playwright/test';
import { register } from '../../instrumentation';

const ORIGINAL = { ...process.env };

const useEnvironment = (values: Record<string, string | undefined>): void => {
  process.env.NEXT_RUNTIME = 'nodejs';

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const restoreEnvironment = (): void => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL)) {
    process.env[key] = value;
  }
};

const COMPLETE = {
  AUTH_DEV_CREDENTIALS: '1',
  BETTER_AUTH_SECRET: 'boot-test-secret',
  BETTER_AUTH_URL: 'http://localhost:4473',
  GITHUB_CLIENT_ID: 'boot-test-github',
  GITHUB_CLIENT_SECRET: 'boot-test-github-secret',
  GOOGLE_CLIENT_ID: 'boot-test-google',
  GOOGLE_CLIENT_SECRET: 'boot-test-google-secret',
};

test.afterEach(() => {
  restoreEnvironment();
});

test.describe('the boot hook', () => {
  test('refuses a half-configured server and names the missing variable', async () => {
    useEnvironment({ ...COMPLETE, DATABASE_URL: undefined });

    await expect(register()).rejects.toThrow('DATABASE_URL');
  });

  test('refuses the dev-credentials flag in production', async () => {
    useEnvironment({
      ...COMPLETE,
      DATABASE_URL: 'postgres://kiyora:kiyora@localhost:5432/kiyora',
      NODE_ENV: 'production',
    });

    await expect(register()).rejects.toThrow(
      'AUTH_DEV_CREDENTIALS must not be set in production'
    );
  });
});
