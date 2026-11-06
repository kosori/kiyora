import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ICON_LIMIT, ICON_NAMES } from './icon-names';
import {
  checkDataset,
  DATASET_PATH,
  pathsOf,
  readIcon,
  renderDataset,
} from './icons';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataset = join(root, DATASET_PATH);
const gate = fileURLToPath(new URL('./icons.ts', import.meta.url));

const temporary: string[] = [];

const makeEmptyRoot = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'kiyora-icons-'));
  temporary.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('the committed dataset', () => {
  it('is exactly what the curated list generates, byte for byte', () => {
    expect(readFileSync(dataset, 'utf8')).toBe(renderDataset());
  });

  it('names every curated icon and reads its path from the library', () => {
    const source = renderDataset(ICON_NAMES);

    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(100);
    expect(ICON_NAMES.length).toBeLessThanOrEqual(ICON_LIMIT);
    for (const name of ['arrow-right', 'file-text', 'user', 'star']) {
      expect(source).toContain(`"${name}":`);
      expect(readIcon(name).length).toBeGreaterThan(0);
    }
  });

  it('refuses a name the library does not ship rather than writing a blank icon', () => {
    expect(() => readIcon('not-a-tabler-icon')).toThrow(/not in the Tabler/);
  });
});

describe('reading a source SVG', () => {
  it('reads attributes quoted with either quote style', () => {
    const svg =
      "<svg><path stroke='none' fill='none' d='M0 0h24v24H0z'/><path d='M1 1'/></svg>";

    expect(pathsOf('fixture', svg)).toEqual(['M1 1']);
  });

  it('skips only the transparent backdrop, never a filled path', () => {
    const svg =
      '<svg><path stroke="none" fill="none" d="M0 0"/><path stroke="none" fill="currentColor" d="M1 1"/></svg>';

    expect(() => pathsOf('fixture', svg)).toThrow(
      /fill="currentColor".*cannot express/
    );
  });

  it('refuses a visible <path> without d instead of dropping it', () => {
    expect(() => pathsOf('fixture', '<svg><path fill="none"/></svg>')).toThrow(
      /fixture has a <path> without a d attribute/
    );
  });

  it('refuses a style value that only starts with none', () => {
    expect(() =>
      pathsOf('fixture', '<svg><path fill="noneX" d="M1 1"/></svg>')
    ).toThrow(/fill="noneX".*cannot express/);
  });

  it('refuses a style value that is not exactly none', () => {
    expect(() =>
      pathsOf('fixture', '<svg><path fill="None" d="M1 1"/></svg>')
    ).toThrow(/fill="None".*cannot express/);
  });
});

describe('the --check gate', () => {
  it('passes the committed dataset', () => {
    expect(checkDataset(dataset)).toBeNull();

    const run = spawnSync('bun', [gate, '--check'], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`${ICON_NAMES.length} icons`);
  });

  it('fails a hand-edited dataset, naming the file', () => {
    const edited = makeEmptyRoot();
    const target = join(edited, DATASET_PATH);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, renderDataset().replace('"M', '"M 1 1 Z M'));

    expect(checkDataset(target)).toMatch(/stale/);

    const run = spawnSync('bun', [gate, '--check', '--root', edited], {
      encoding: 'utf8',
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain(DATASET_PATH);
  });
});

describe('lazy loading', () => {
  const SOURCE = ['.ts', '.tsx'];

  /** Every source file under `directory`, as absolute paths. */
  const walk = (directory: string): string[] => {
    const found: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.next', '.turbo', 'dist'].includes(entry.name)) {
        continue;
      }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        found.push(...walk(path));
        continue;
      }
      if (SOURCE.includes(extname(entry.name))) {
        found.push(path);
      }
    }
    return found;
  };

  it('is only ever reached by a dynamic import, never a static one', () => {
    const files = [...walk(join(root, 'apps')), ...walk(join(root, 'packages'))]
      .filter((path) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path))
      .filter((path) => path !== dataset);
    const staticImport = /(?:from\s+|import\s+)['"]@kiyora\/model\/icons['"]/;
    const offenders = files.filter((path) =>
      staticImport.test(readFileSync(path, 'utf8'))
    );
    const dynamic = files.filter((path) =>
      /import\(['"]@kiyora\/model\/icons['"]\)/.test(readFileSync(path, 'utf8'))
    );

    expect(offenders.map((path) => relative(root, path))).toEqual([]);
    expect(dynamic.length).toBeGreaterThan(0);
  });
});
