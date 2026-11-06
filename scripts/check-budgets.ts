import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { messageOf, rootFrom, runsAsScript, UsageError } from './cli';

/** Lines allowed in one source file. */
export const SOURCE_BUDGET = 400;

/** Lines allowed in one test file. */
export const TEST_BUDGET = 600;

/** Paths whose contents are restored from elsewhere and are never trimmed. */
export const VENDORED_PATHS = [
  'apps/web/components/ui',
  'packages/dsl/src',
] as const;

const SOURCE_EXTENSIONS = [
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
];

const SKIPPED_DIRECTORIES = [
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
];

const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

const usage = 'usage: bun scripts/check-budgets.ts [--root <directory>]';

/** A root that holds no source file, so the gate would pass without checking anything. */
class EmptyRootError extends Error {
  readonly name = 'EmptyRootError';
}

/** One file's size against the budget it is held to. */
export type BudgetViolation = {
  path: string;
  lines: number;
  budget: number;
};

/** One file's repository-relative path and its contents. */
export type SourceFile = {
  path: string;
  source: string;
};

const toPosix = (path: string): string => path.replaceAll('\\', '/');

/** Whether the file name marks the file as a test, which carries the looser budget. */
export const isTestFile = (path: string): boolean =>
  TEST_FILE.test(toPosix(path));

/** Whether the path is vendored, and therefore exempt from the budget however long it grows. */
export const isVendored = (path: string): boolean => {
  const normalised = toPosix(path);
  return VENDORED_PATHS.some(
    (vendored) =>
      normalised === vendored || normalised.startsWith(`${vendored}/`)
  );
};

/** The number of lines in the source, not counting the newline that ends the last one. */
export const countLines = (source: string): number => {
  if (source.length === 0) {
    return 0;
  }
  const trimmed = source.endsWith('\n') ? source.slice(0, -1) : source;
  return trimmed.split('\n').length;
};

/** The line budget the path is held to. */
export const budgetFor = (path: string): number =>
  isTestFile(path) ? TEST_BUDGET : SOURCE_BUDGET;

/** Every file over its budget, ignoring vendored paths. */
export const checkFiles = (files: readonly SourceFile[]): BudgetViolation[] =>
  files
    .filter((file) => !isVendored(file.path))
    .map((file) => ({
      budget: budgetFor(file.path),
      lines: countLines(file.source),
      path: file.path,
    }))
    .filter((violation) => violation.lines > violation.budget);

/**
 * Every source file under the root, as repository-relative posix paths.
 *
 * A vendored tree is skipped before it is read or descended into, so the gate
 * never pays for what it discards. Symlinks are resolved through `statSync`, so
 * a linked file or subtree is still counted, while a directory realpath already
 * visited is not walked again and a broken link is ignored.
 */
export const collectSourceFiles = (root: string): string[] => {
  const found: string[] = [];
  const visited = new Set<string>();

  const walk = (directory: string): void => {
    const real = realpathSync(directory);
    if (visited.has(real)) {
      return;
    }
    visited.add(real);

    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      const fromRoot = toPosix(relative(root, path));
      if (isVendored(fromRoot)) {
        continue;
      }

      const stat = statSync(path, { throwIfNoEntry: false });
      if (stat === undefined) {
        continue;
      }
      if (stat.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.includes(name)) {
          walk(path);
        }
        continue;
      }
      if (stat.isFile() && SOURCE_EXTENSIONS.includes(extname(name))) {
        found.push(fromRoot);
      }
    }
  };

  walk(root);
  return found.sort();
};

/** The budget for the whole repository under the root; refuses a root with nothing to check. */
export const checkRepository = (root: string): BudgetViolation[] => {
  const files = collectSourceFiles(root);
  if (files.length === 0) {
    throw new EmptyRootError(`no source files under ${root}`);
  }

  return checkFiles(
    files.map((path) => ({
      path,
      source: readFileSync(join(root, path), 'utf8'),
    }))
  );
};

const report = (violations: readonly BudgetViolation[]): number => {
  if (violations.length === 0) {
    process.stdout.write(
      `budgets: within ${SOURCE_BUDGET} lines of source and ${TEST_BUDGET} of test\n`
    );
    return 0;
  }
  const lines = violations
    .map(
      ({ path, lines: count, budget }) =>
        `  ${path}: ${count} lines, budget ${budget}\n`
    )
    .join('');
  process.stderr.write(
    `budgets: ${violations.length} file(s) over budget\n${lines}`
  );
  return 1;
};

if (runsAsScript(import.meta.url)) {
  try {
    const root = rootFrom(process.argv.slice(2), process.cwd());
    process.exitCode = report(checkRepository(root));
  } catch (error) {
    process.stderr.write(`budgets: ${messageOf(error)}\n`);
    const misuse =
      error instanceof UsageError || error instanceof EmptyRootError;
    if (misuse) {
      process.stderr.write(`${usage}\n`);
    }
    process.exitCode = misuse ? 1 : 2;
  }
}
