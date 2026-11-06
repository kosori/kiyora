import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  budgetFor,
  checkRepository,
  collectSourceFiles,
  countLines,
  isTestFile,
  isVendored,
  SOURCE_BUDGET,
  TEST_BUDGET,
} from './check-budgets';

const gate = fileURLToPath(new URL('./check-budgets.ts', import.meta.url));

const roots: string[] = [];

const makeRoot = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), 'kiyora-budgets-'));
  roots.push(root);
  for (const [path, source] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
};

const sourceLines = (count: number): string => 'const x = 1;\n'.repeat(count);
const testLines = (count: number): string =>
  "it('x', () => {});\n".repeat(count);

const runGate = (root: string): ReturnType<typeof spawnSync> =>
  spawnSync('bun', [gate, '--root', root], { encoding: 'utf8' });

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('countLines', () => {
  it('counts an empty file as no lines', () => {
    expect(countLines('')).toBe(0);
  });

  it('counts the last line whether or not a newline ends it', () => {
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\nb\n')).toBe(2);
  });
});

describe('budget', () => {
  it('allows 400 lines in source and 600 in a test', () => {
    expect(SOURCE_BUDGET).toBe(400);
    expect(TEST_BUDGET).toBe(600);
    expect(budgetFor('packages/model/src/board.ts')).toBe(400);
    expect(budgetFor('packages/model/src/board.test.ts')).toBe(600);
    expect(budgetFor('apps/web/tests/e2e/camera.spec.tsx')).toBe(600);
  });

  it('recognises a test by its file name alone', () => {
    expect(isTestFile('packages/editor/src/history/gestures.test.ts')).toBe(
      true
    );
    expect(isTestFile('packages/model/src/board.ts')).toBe(false);
    expect(isTestFile('packages/model/src/testing.ts')).toBe(false);
  });
});

describe('vendored paths', () => {
  it('exempts the vendored parser and the vendored UI components', () => {
    expect(isVendored('packages/dsl/src/index.ts')).toBe(true);
    expect(isVendored('apps/web/components/ui/button.tsx')).toBe(true);
    expect(isVendored('packages/dsl/README.md')).toBe(false);
    expect(isVendored('apps/web/components/board.tsx')).toBe(false);
  });
});

describe('checkRepository', () => {
  it('passes a source file at the budget and a test at its own', () => {
    const root = makeRoot({
      'packages/model/src/board.test.ts': testLines(600),
      'packages/model/src/board.ts': sourceLines(400),
    });

    expect(checkRepository(root)).toEqual([]);
  });

  it('fails a source file one line over its budget', () => {
    const root = makeRoot({ 'packages/model/src/board.ts': sourceLines(401) });

    expect(checkRepository(root)).toEqual([
      { budget: 400, lines: 401, path: 'packages/model/src/board.ts' },
    ]);
  });

  it('fails a test file one line over its own budget', () => {
    const root = makeRoot({
      'packages/model/src/board.test.ts': testLines(601),
    });

    expect(checkRepository(root)).toEqual([
      { budget: 600, lines: 601, path: 'packages/model/src/board.test.ts' },
    ]);
  });

  it('lets a test file run past the source budget', () => {
    const root = makeRoot({
      'packages/model/src/board.test.ts': testLines(500),
    });

    expect(checkRepository(root)).toEqual([]);
  });

  it('exempts vendored code however long it grows', () => {
    const root = makeRoot({
      'apps/web/components/ui/button.tsx': sourceLines(5000),
      'packages/dsl/src/grammar.ts': sourceLines(5000),
      'packages/model/src/board.ts': sourceLines(400),
    });

    expect(checkRepository(root)).toEqual([]);
  });

  it('ignores files that are not source', () => {
    const root = makeRoot({
      'bun.lock': '{}\n'.repeat(5000),
      'docs/notes.md': 'a line\n'.repeat(5000),
      'packages/model/src/board.ts': sourceLines(400),
    });

    expect(checkRepository(root)).toEqual([]);
  });

  it('skips a vendored tree before reading it', () => {
    const root = makeRoot({
      'apps/web/components/ui/button.tsx': sourceLines(5000),
      'packages/dsl/src/grammar.ts': sourceLines(5000),
      'packages/model/src/board.ts': sourceLines(400),
    });

    expect(collectSourceFiles(root)).toEqual(['packages/model/src/board.ts']);
    expect(checkRepository(root)).toEqual([]);
  });

  it('counts a symlinked source file', () => {
    const outside = makeRoot({ 'board.ts': sourceLines(401) });
    const root = makeRoot({});
    mkdirSync(join(root, 'packages/model/src'), { recursive: true });
    symlinkSync(
      join(outside, 'board.ts'),
      join(root, 'packages/model/src/board.ts')
    );

    expect(checkRepository(root)).toEqual([
      { budget: 400, lines: 401, path: 'packages/model/src/board.ts' },
    ]);
  });

  it('counts a symlinked directory and its subtree', () => {
    const outside = makeRoot({ 'board.ts': sourceLines(401) });
    const root = makeRoot({});
    symlinkSync(outside, join(root, 'linked'), 'dir');

    expect(checkRepository(root)).toEqual([
      { budget: 400, lines: 401, path: 'linked/board.ts' },
    ]);
  });

  it('does not follow a symlink back to an ancestor', () => {
    const root = makeRoot({ 'packages/model/src/board.ts': sourceLines(401) });
    symlinkSync(root, join(root, 'loop'), 'dir');

    expect(checkRepository(root)).toEqual([
      { budget: 400, lines: 401, path: 'packages/model/src/board.ts' },
    ]);
  });

  it('refuses a root with no source files instead of passing vacuously', () => {
    const root = makeRoot({ 'docs/notes.md': 'a line\n' });

    expect(() => checkRepository(root)).toThrow(/no source files under/);
  });
});

describe('the gate', () => {
  it('exits non-zero, naming the file, when one exceeds the budget', () => {
    const root = makeRoot({ 'packages/model/src/board.ts': sourceLines(401) });

    const run = runGate(root);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('packages/model/src/board.ts');
  });

  it('exits zero when every file is within budget', () => {
    const root = makeRoot({ 'packages/model/src/board.ts': sourceLines(400) });

    expect(runGate(root).status).toBe(0);
  });

  it('still runs when invoked through a symlink', () => {
    const root = makeRoot({ 'packages/model/src/board.ts': sourceLines(401) });
    const directory = mkdtempSync(join(tmpdir(), 'kiyora-link-'));
    roots.push(directory);
    const link = join(directory, 'check-budgets.ts');
    symlinkSync(gate, link);

    const run = spawnSync('bun', [link, '--root', root], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('packages/model/src/board.ts');
  });

  it('rejects a bare --root with the usage line', () => {
    const run = spawnSync('bun', [gate, '--root'], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('usage:');
  });

  it('rejects a --root that swallowed the next flag', () => {
    const run = spawnSync('bun', [gate, '--root', '--check'], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('--root needs a directory');
  });

  it('exits 2 when the root cannot be read', () => {
    const missing = mkdtempSync(join(tmpdir(), 'kiyora-missing-'));
    rmSync(missing, { force: true, recursive: true });

    const run = spawnSync('bun', [gate, '--root', missing], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('budgets:');
  });

  it('exits 1 when the root holds no source files', () => {
    const root = makeRoot({ 'docs/notes.md': 'a line\n' });

    const run = runGate(root);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('no source files');
  });
});
