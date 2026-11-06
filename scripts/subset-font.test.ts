import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { UsageError } from './cli';
import { cachedSource, downloadSource, parseRun, WEIGHTS } from './subset-font';

const fonts = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'public',
  'fonts'
);

const files = readdirSync(fonts);

const [{ source: regularSource }] = WEIGHTS;

const temporary: string[] = [];

const makeDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'kiyora-fonts-'));
  temporary.push(directory);
  return directory;
};

const respond =
  (body: string, status = 200): typeof fetch =>
  async () =>
    new Response(body, { status });

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('the committed font subsets', () => {
  it('are exactly the faces the subset script can reproduce', () => {
    expect(files.filter((file) => file.endsWith('.woff2')).sort()).toEqual(
      WEIGHTS.map((weight) => weight.output).sort()
    );
  });

  it('ship the licence text for each face beside the bytes', () => {
    expect(files.filter((file) => file.startsWith('OFL-')).sort()).toEqual([
      'OFL-BalsamiqSansNeue.txt',
      'OFL-GeistMono.txt',
    ]);
  });
});

describe('parsing the weights to cut', () => {
  it('cuts every weight when none is named', () => {
    expect(parseRun([]).weights).toEqual([...WEIGHTS]);
    expect(parseRun([]).offline).toBe(false);
  });

  it('reads --offline without consuming a weight', () => {
    const run = parseRun(['--offline', 'geist-mono-regular']);

    expect(run.offline).toBe(true);
    expect(run.weights).toEqual([WEIGHTS[2]]);
  });

  it('rejects an unknown flag instead of running online', () => {
    expect(() => parseRun(['--offlin'])).toThrow(UsageError);
    expect(() => parseRun(['--offlin'])).toThrow(/unknown flag\(s\): --offlin/);
  });

  it('rejects a bare -x as an unknown flag', () => {
    expect(() => parseRun(['-x'])).toThrow(/unknown flag\(s\): -x/);
  });

  it('selects a weight by its exact name, never a substring', () => {
    expect(() => parseRun(['mono'])).toThrow(/unknown weight\(s\): mono/);
    expect(() => parseRun(['balsamiq'])).toThrow(
      /unknown weight\(s\): balsamiq/
    );
  });

  it('lists the valid weight names when one is unknown', () => {
    expect(() => parseRun(['geist'])).toThrow(
      /valid weights: balsamiq-sans-neue-regular, balsamiq-sans-neue-bold, geist-mono-regular, geist-mono-bold/
    );
  });
});

describe('the downloaded TTF cache', () => {
  it('does not trust a truncated .partial as a cached TTF', () => {
    const directory = makeDirectory();
    const source = regularSource;
    const cached = join(directory, source);

    writeFileSync(`${cached}.partial`, 'truncated');
    expect(cachedSource(directory, source)).toBeNull();

    writeFileSync(cached, 'complete');
    expect(cachedSource(directory, source)).toBe(cached);
  });

  it('renames a completed download into place and leaves no partial', async () => {
    const directory = makeDirectory();
    const cached = join(directory, regularSource);

    await downloadSource(
      cached,
      'https://example.test/font.ttf',
      respond('ttf')
    );

    expect(readFileSync(cached, 'utf8')).toBe('ttf');
    expect(existsSync(`${cached}.partial`)).toBe(false);
  });

  it('removes the partial when the download fails', async () => {
    const directory = makeDirectory();
    const cached = join(directory, regularSource);

    await expect(
      downloadSource(cached, 'https://example.test/font.ttf', respond('', 404))
    ).rejects.toThrow(/failed: 404/);

    expect(existsSync(cached)).toBe(false);
    expect(existsSync(`${cached}.partial`)).toBe(false);
  });

  it('surfaces a timeout as a normal thrown error', async () => {
    const directory = makeDirectory();
    const cached = join(directory, regularSource);
    const timedOut: typeof fetch = () =>
      Promise.reject(
        Object.assign(new Error('aborted'), { name: 'TimeoutError' })
      );

    await expect(
      downloadSource(cached, 'https://example.test/font.ttf', timedOut)
    ).rejects.toThrow(/timed out after 30000 ms/);
  });
});
