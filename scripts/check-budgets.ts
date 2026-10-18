import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Every source file under the root, as repository-relative posix paths. */
export const collectSourceFiles = (root: string): string[] => {
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.includes(entry.name)) {
          walk(path);
        }
        continue;
      }
      if (entry.isFile() && SOURCE_EXTENSIONS.includes(extname(entry.name))) {
        found.push(toPosix(relative(root, path)));
      }
    }
  };

  walk(root);
  return found.sort();
};

/** The budget for the whole repository under the root. */
export const checkRepository = (root: string): BudgetViolation[] =>
  checkFiles(
    collectSourceFiles(root).map((path) => ({
      path,
      source: readFileSync(join(root, path), 'utf8'),
    }))
  );

const rootFrom = (argv: readonly string[]): string => {
  const flag = argv.indexOf('--root');
  const value = flag === -1 ? undefined : argv[flag + 1];
  return value === undefined ? process.cwd() : resolve(value);
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

const runsAsScript = (): boolean => {
  const [, entry] = process.argv;
  return (
    entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)
  );
};

if (runsAsScript()) {
  process.exitCode = report(checkRepository(rootFrom(process.argv.slice(2))));
}
