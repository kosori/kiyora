import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The command-line surface the scripts in this directory share: a rejected
 * input, the `--root` both tree walkers accept, and the entry-point check that
 * decides whether a module was launched or imported by a test.
 */

/** A rejected argument, carrying the message the person needs to fix it. */
export class UsageError extends Error {
  readonly name = 'UsageError';
}

/** The message of an unknown thrown value, for a line a person can act on. */
export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The tree a script operates on: the `--root <dir>` argument when given,
 * `fallback` otherwise. A bare `--root` and a `--root --check` both name no
 * directory, so both are a `UsageError` rather than a silent fallback.
 */
export const rootFrom = (argv: readonly string[], fallback: string): string => {
  const flag = argv.indexOf('--root');
  if (flag === -1) {
    return fallback;
  }

  const value = argv[flag + 1];
  if (value === undefined || value.startsWith('-')) {
    throw new UsageError('--root needs a directory');
  }

  return resolve(value);
};

/**
 * Whether `moduleUrl` was launched as the entry script. Both sides are compared
 * as realpaths, so a script reached through a symlink still runs instead of
 * looking imported and exiting 0; a path that cannot be resolved is not entry.
 */
export const runsAsScript = (moduleUrl: string): boolean => {
  const [, entry] = process.argv;
  if (entry === undefined) {
    return false;
  }

  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
};
